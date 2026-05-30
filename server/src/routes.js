const express = require('express');
const { getDb } = require('./database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const ldap = require('ldapjs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'djcp_jwt_secret_key_2026';
const router = express.Router();

// ===================== 工具函数 =====================

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd + 'djcp_salt').digest('hex');
}

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
}


// LDAP/AD 域控认证
function ldapAuthenticate(username, password, settings) {
  return new Promise((resolve, reject) => {
    const url = 'ldap://' + settings.ldap_server + ':' + (settings.ldap_port || '389');
    const client = ldap.createClient({ url, connectTimeout: 5000 });
    
    let settled = false;
    
    client.on('connectError', (err) => {
      if (!settled) { settled = true; client.destroy(); reject(new Error('无法连接域控服务器')); }
    });
    
    client.on('error', (err) => {
      if (!settled) { settled = true; client.destroy(); reject(new Error('域控连接异常: ' + (err.message || ''))); }
    });
    
    client.on('connectTimeout', () => {
      if (!settled) { settled = true; client.destroy(); reject(new Error('域控服务器连接超时')); }
    });
    
    // 构造用户 DN：优先用 UPN 格式(user@domain)，否则用 CN 格式
    let dn;
    if (settings.ldap_domain) {
      dn = username + '@' + settings.ldap_domain;
    } else {
      dn = 'CN=' + username + ',' + settings.ldap_base_dn;
    }
    
    client.bind(dn, password, (err) => {
      if (settled) return;
      settled = true;
      client.destroy();
      if (err) {
        const msg = err.message || '';
        if (msg.includes('invalidCredentials') || msg.includes('Invalid Credentials')) {
          reject(new Error('域控用户名或密码错误'));
        } else {
          reject(new Error('域控认证失败: ' + (msg || '未知错误')));
        }
      } else {
        resolve();
      }
    });
  });
}

// 写入审计日志
function auditLog(db, userId, username, realName, action, module, targetType, targetId, detail, result) {
  db.prepare(`INSERT INTO audit_logs (user_id, username, real_name, action, module, target_type, target_id, detail, result)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(userId, username, realName, action, module, targetType, targetId || null, detail || null, result || 'success');
}

// 权限中间件
function requirePermission(...permCodes) {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: '未登录' });

    const db = getDb();
    let userInfo = null;

    // 优先尝试 JWT 验证
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.prepare('SELECT id, username, real_name, role, status FROM users WHERE id=?').get(decoded.id);
      if (user && user.status === 'active') {
        userInfo = { id: user.id, username: user.username, real_name: user.real_name, role: user.role };
      }
    } catch (_jwtError) {
      // JWT 验证失败，回退到 session 数据库查询
    }

    // 回退：Session DB 查询
    if (!userInfo) {
      const session = db.prepare(`
        SELECT s.*, u.username, u.real_name, u.role, u.status
        FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > datetime('now')
      `).get(token);

      if (!session) return res.status(401).json({ error: '登录已过期' });
      if (session.status !== 'active') return res.status(403).json({ error: '账号已禁用' });
      userInfo = { id: session.user_id, username: session.username, real_name: session.real_name, role: userInfo.role };
    }

    // 附加用户信息到请求
    req.user = userInfo;

    // 检查权限
    if (permCodes.length > 0) {
      const userPerms = db.prepare('SELECT permission_code FROM role_permissions WHERE role=?').all(userInfo.role).map(p => p.permission_code);
      const hasAll = permCodes.every(code => userPerms.includes(code));
      if (!hasAll) return res.status(403).json({ error: '权限不足', required: permCodes });
    }

    next();
  };
}

// Multer config
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ===================== 认证 =====================
router.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: '请输入用户名和密码' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);

  if (!user) {
    auditLog(db, null, username, null, 'login', 'auth', 'user', null, '登录失败：用户名或密码错误', 'failure');
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }

  // LDAP/域控账户登录
  if (user.login_type === 'ldap') {
    const ldapEnabled = db.prepare("SELECT value FROM settings WHERE key='ldap_enabled'").get();
    if (!ldapEnabled || ldapEnabled.value !== 'true') {
      return res.status(400).json({ success: false, message: '域控登录未启用，请联系管理员' });
    }
    const ldapSettings = {};
    const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'ldap_%'").all();
    for (const r of rows) ldapSettings[r.key] = r.value;
    
    if (!ldapSettings.ldap_server) {
      return res.status(400).json({ success: false, message: '域控服务器未配置' });
    }
    
    try {
      await ldapAuthenticate(username, password, ldapSettings);
    } catch (e) {
      auditLog(db, null, username, null, 'login', 'auth', 'user', null, e.message, 'failure');
      return res.status(401).json({ success: false, message: e.message });
    }
  } else {
    // 本地密码认证
    if (!bcrypt.compareSync(password, user.password)) {
      auditLog(db, null, username, null, 'login', 'auth', 'user', null, '登录失败：用户名或密码错误', 'failure');
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
  }

  if (user.status !== 'active') {
    auditLog(db, user.id, username, user.real_name, 'login', 'auth', 'user', String(user.id), '登录失败：账号已禁用', 'failure');
    return res.status(403).json({ success: false, message: '账号已被禁用，请联系管理员' });
  }

  // 创建会话
  const token = generateToken(user);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24小时
  db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?,?,?)').run(user.id, token, expiresAt);

  // 清除旧会话
  db.prepare("DELETE FROM sessions WHERE user_id=? AND token!=?").run(user.id, token);

  // 更新最后登录时间
  db.prepare('UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?').run(user.id);

  auditLog(db, user.id, username, user.real_name, 'login', 'auth', 'user', String(user.id), '登录成功');

  // 获取用户权限列表
  const permissions = db.prepare('SELECT permission_code FROM role_permissions WHERE role=?').all(user.role).map(p => p.permission_code);

  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, real_name: user.real_name, role: user.role, department: user.department, permissions }
  });
});

router.post('/api/logout', requirePermission(), (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token=?').run(token);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'logout', 'auth', 'user', String(req.user.id), '登出');
  res.json({ success: true });
});

router.get('/api/me', requirePermission(), (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, real_name, role, department, phone, email, status, last_login, login_type, ldap_dn FROM users WHERE id=?').get(req.user.id);
  const permissions = db.prepare('SELECT permission_code FROM role_permissions WHERE role=?').all(user.role).map(p => p.permission_code);
  res.json({ ...user, permissions });
});

// ===================== 仪表盘统计 =====================
router.get('/api/dashboard/stats', requirePermission('dashboard:view'), (req, res) => {
  const db = getDb();
  const stats = {
    totalSystems: db.prepare('SELECT COUNT(*) as cnt FROM systems').get().cnt,
    classifiedSystems: db.prepare("SELECT COUNT(*) as cnt FROM systems WHERE status IN ('classified','filed','assessing','rectifying','completed')").get().cnt,
    filedSystems: db.prepare("SELECT COUNT(*) as cnt FROM systems WHERE status IN ('filed','assessing','rectifying','completed')").get().cnt,
    assessmentsCompleted: db.prepare("SELECT COUNT(*) as cnt FROM assessments WHERE status='completed'").get().cnt,
    rectificationsTotal: db.prepare('SELECT COUNT(*) as cnt FROM rectifications').get().cnt,
    rectificationsCompleted: db.prepare("SELECT COUNT(*) as cnt FROM rectifications WHERE status IN ('completed','verified')").get().cnt,
    rectificationsPending: db.prepare("SELECT COUNT(*) as cnt FROM rectifications WHERE status IN ('pending','in_progress')").get().cnt,
    documentsTotal: db.prepare('SELECT COUNT(*) as cnt FROM documents').get().cnt,
    levelDistribution: db.prepare('SELECT security_level, COUNT(*) as cnt FROM systems GROUP BY security_level ORDER BY security_level').all(),
    statusDistribution: db.prepare('SELECT status, COUNT(*) as cnt FROM systems GROUP BY status').all(),
    recentAssessments: db.prepare('SELECT a.*, s.name as system_name FROM assessments a JOIN systems s ON a.system_id = s.id ORDER BY a.created_at DESC LIMIT 5').all(),
    overdueRectifications: db.prepare("SELECT r.*, s.name as system_name FROM rectifications r JOIN systems s ON r.system_id = s.id WHERE r.status IN ('pending','in_progress') AND r.plan_end_date < date('now') ORDER BY r.plan_end_date ASC").all()
  };
  res.json(stats);
});

// ===================== 信息系统 CRUD =====================
router.get('/api/systems', requirePermission('system:view'), (req, res) => {
  const db = getDb();
  const { status, level, search } = req.query;
  let sql = 'SELECT * FROM systems WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status=?'; params.push(status); }
  if (level) { sql += ' AND security_level=?'; params.push(parseInt(level)); }
  if (search) { sql += ' AND (name LIKE ? OR code LIKE ? OR department LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ' ORDER BY updated_at DESC';
  const systems = db.prepare(sql).all(...params);
  for (const s of systems) {
    s.classification = db.prepare('SELECT * FROM classifications WHERE system_id=? ORDER BY classified_at DESC LIMIT 1').get(s.id) || null;
    s.latestAssessment = db.prepare('SELECT * FROM assessments WHERE system_id=? ORDER BY assessment_date DESC LIMIT 1').get(s.id) || null;
    s.pendingRectifications = db.prepare("SELECT COUNT(*) as cnt FROM rectifications WHERE system_id=? AND status IN ('pending','in_progress')").get(s.id).cnt;
  }
  res.json(systems);
});

router.get('/api/systems/:id', requirePermission('system:view'), (req, res) => {
  const db = getDb();
  const system = db.prepare('SELECT * FROM systems WHERE id=?').get(req.params.id);
  if (!system) return res.status(404).json({ error: '未找到该系统' });
  system.classification = db.prepare('SELECT * FROM classifications WHERE system_id=? ORDER BY classified_at DESC LIMIT 1').get(system.id) || null;
  system.filing = db.prepare('SELECT * FROM filings WHERE system_id=? ORDER BY created_at DESC LIMIT 1').get(system.id) || null;
  system.gapAnalyses = db.prepare('SELECT * FROM gap_analyses WHERE system_id=? ORDER BY analysis_date DESC').all(system.id);
  system.rectifications = db.prepare('SELECT * FROM rectifications WHERE system_id=? ORDER BY created_at DESC').all(system.id);
  system.assessments = db.prepare('SELECT * FROM assessments WHERE system_id=? ORDER BY assessment_date DESC').all(system.id);
  system.documents = db.prepare('SELECT * FROM documents WHERE system_id=? ORDER BY uploaded_at DESC').all(system.id);
  res.json(system);
});

router.post('/api/systems', requirePermission('system:create'), (req, res) => {
  const db = getDb();
  const { name, code, department, category, description, security_level, status } = req.body;
  const result = db.prepare('INSERT INTO systems (name, code, department, category, description, security_level, status) VALUES (?,?,?,?,?,?,?)')
    .run(name, code, department, category, description, security_level, status || 'draft');
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'create', 'system', 'system', String(result.lastInsertRowid), `创建信息系统: ${name}`);
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/api/systems/:id', requirePermission('system:edit'), (req, res) => {
  const db = getDb();
  const { name, code, department, category, description, security_level, status } = req.body;
  db.prepare('UPDATE systems SET name=?, code=?, department=?, category=?, description=?, security_level=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(name, code, department, category, description, security_level, status, req.params.id);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'update', 'system', 'system', req.params.id, `修改信息系统: ${name}`);
  res.json({ success: true });
});

router.delete('/api/systems/:id', requirePermission('system:delete'), (req, res) => {
  const db = getDb();
  const sys = db.prepare('SELECT name FROM systems WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM systems WHERE id=?').run(req.params.id);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'delete', 'system', 'system', req.params.id, `删除信息系统: ${sys?.name}`);
  res.json({ success: true });
});

// ===================== 定级管理 =====================
router.get('/api/classifications', requirePermission('classification:view'), (req, res) => {
  const db = getDb();
  const { system_id } = req.query;
  let sql = 'SELECT c.*, s.name as system_name FROM classifications c JOIN systems s ON c.system_id = s.id';
  const params = [];
  if (system_id) { sql += ' WHERE c.system_id=?'; params.push(system_id); }
  sql += ' ORDER BY c.classified_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/api/classifications', requirePermission('classification:create'), (req, res) => {
  const db = getDb();
  const { system_id, business_impact_level, service_scope, business_dependency, classification_report, classified_by } = req.body;
  const result = db.prepare('INSERT INTO classifications (system_id, business_impact_level, service_scope, business_dependency, classification_report, classified_by) VALUES (?,?,?,?,?,?)')
    .run(system_id, business_impact_level, service_scope, business_dependency, classification_report, classified_by);
  db.prepare("UPDATE systems SET status='classified', security_level=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(business_impact_level, system_id);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'create', 'classification', 'system', String(system_id), `系统定级: L${business_impact_level}`);
  res.json({ id: result.lastInsertRowid, ...req.body });
});

// 生成定级报告
router.get('/api/classifications/:id/report', (req, res) => {
  const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未提供认证令牌' });
  const db = getDb();
  let userId = null;
  try { const d = jwt.verify(token, JWT_SECRET); userId = d.id; } catch(_) {
    const s = db.prepare("SELECT user_id FROM sessions WHERE token=? AND expires_at > datetime('now')").get(token);
    if (s) userId = s.user_id;
  }
  if (!userId) return res.status(401).json({ error: '令牌无效或已过期' });

  const cls = db.prepare(`
    SELECT c.*, s.name as system_name, s.code as system_code, s.department, s.category, s.description as system_desc, s.security_level
    FROM classifications c JOIN systems s ON c.system_id = s.id WHERE c.id=?
  `).get(req.params.id);
  if (!cls) return res.status(404).json({ error: '定级记录不存在' });

  const levelLabels = { 1: '自主保护级', 2: '指导保护级', 3: '监督保护级', 4: '强制保护级', 5: '专控保护级' };
  const catLabels = { S1:'业务信息安全-一般', S2:'业务信息安全-严重', S3:'业务信息安全-特别严重', G1:'系统服务安全-一般', G2:'系统服务安全-严重', G3:'系统服务安全-特别严重' };

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>等级保护定级报告 - ${cls.system_name}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: "SimSun","STSong","PingFang SC","Microsoft YaHei",serif; font-size:14px; line-height:1.8; color:#333; max-width:800px; margin:0 auto; padding:40px 60px; }
  h1 { text-align:center; font-size:22px; margin-bottom:10px; }
  .subtitle { text-align:center; color:#666; font-size:13px; margin-bottom:30px; border-bottom:2px solid #1a56db; padding-bottom:20px; }
  h2 { font-size:16px; margin:24px 0 12px; padding-left:12px; border-left:3px solid #1a56db; }
  table { width:100%; border-collapse:collapse; margin:12px 0; }
  th, td { border:1px solid #d1d5db; padding:8px 12px; text-align:left; }
  th { background:#f3f4f6; font-weight:bold; width:140px; }
  .level-badge { display:inline-block; padding:2px 12px; border-radius:4px; font-weight:bold; color:#fff; }
  .level-1 { background:#6b7280; } .level-2 { background:#3b82f6; } .level-3 { background:#f59e0b; } .level-4 { background:#ef4444; } .level-5 { background:#7c3aed; }
  .matrix { text-align:center; margin:16px 0; }
  .matrix th { text-align:center; width:auto; background:#1e3a5f; color:#fff; }
  .matrix td { text-align:center; padding:10px; }
  .matrix .match { background:#fef2f2; font-weight:bold; color:#dc2626; }
  .footer { margin-top:40px; padding-top:16px; border-top:1px solid #d1d5db; color:#666; font-size:12px; text-align:right; }
  @media print { body { padding:20px; } .no-print { display:none; } }
</style>
</head>
<body>
<h1>网络安全等级保护定级报告</h1>
<div class="subtitle">报告编号: DJCP-DJ-${String(cls.id).padStart(4,'0')} &nbsp;|&nbsp; 生成日期: ${new Date().toISOString().slice(0,10)}</div>

<h2>一、信息系统基本信息</h2>
<table>
  <tr><th>系统名称</th><td>${cls.system_name}</td></tr>
  <tr><th>系统编号</th><td>${cls.system_code || '-'}</td></tr>
  <tr><th>所属部门</th><td>${cls.department || '-'}</td></tr>
  <tr><th>系统类别</th><td>${catLabels[cls.category] || cls.category || '-'}</td></tr>
  <tr><th>安全保护等级</th><td><span class="level-badge level-${cls.security_level||'-'}">第${cls.security_level||'-'}级 ${levelLabels[cls.security_level]||''}</span></td></tr>
  <tr><th>系统描述</th><td>${cls.system_desc || '-'}</td></tr>
</table>

<h2>二、定级结果</h2>
<table>
  <tr><th>业务信息安全等级</th><td><span class="level-badge level-${cls.business_impact_level}">第${cls.business_impact_level}级 ${levelLabels[cls.business_impact_level]}</span></td></tr>
  <tr><th>服务范围</th><td>${cls.service_scope || '-'}</td></tr>
  <tr><th>业务依赖描述</th><td>${cls.business_dependency || '-'}</td></tr>
  <tr><th>定级人</th><td>${cls.classified_by || '-'}</td></tr>
  <tr><th>定级日期</th><td>${cls.classified_at || '-'}</td></tr>
</table>

<h2>三、定级依据</h2>
<p>根据《信息安全技术 网络安全等级保护定级指南》（GB/T 22240-2020），结合信息系统在国家安全、经济建设、社会生活中的重要程度，以及系统遭到破坏后对国家安全、社会秩序、公共利益以及公民、法人和其他组织合法权益的危害程度等因素，确定信息系统的安全保护等级。</p>

<h2>四、等级保护定级矩阵</h2>
<table class="matrix">
  <tr><th></th><th>G1 一般损害</th><th>G2 严重损害</th><th>G3 特别严重损害</th></tr>
  <tr><td><strong>S1 一般损害</strong></td><td class="${cls.business_impact_level===1?'match':''}">第一级</td><td class="${cls.business_impact_level===2?'match':''}">第二级</td><td class="${cls.business_impact_level===3?'match':''}">第三级</td></tr>
  <tr><td><strong>S2 严重损害</strong></td><td class="${cls.business_impact_level===2?'match':''}">第二级</td><td class="${cls.business_impact_level===3?'match':''}">第三级</td><td class="${cls.business_impact_level===4?'match':''}">第四级</td></tr>
  <tr><td><strong>S3 特别严重损害</strong></td><td class="${cls.business_impact_level===3?'match':''}">第三级</td><td class="${cls.business_impact_level===4?'match':''}">第四级</td><td class="${cls.business_impact_level===5?'match':''}">第五级</td></tr>
</table>
<p style="text-align:center;color:#dc2626;font-weight:bold">▲ 当前定级结果：第${cls.business_impact_level}级 - ${levelLabels[cls.business_impact_level]}</p>

<h2>五、定级说明</h2>
<p>${cls.classification_report || '（详见定级报告正文）'}</p>

<div class="footer">
  <p>报告生成时间: ${new Date().toLocaleString('zh-CN')}</p>
  <p>本报告由等保测评全生命周期管理系统自动生成</p>
</div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ===================== 备案管理 =====================
router.get('/api/filings', requirePermission('filing:view'), (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT f.*, s.name as system_name FROM filings f JOIN systems s ON f.system_id = s.id ORDER BY f.created_at DESC').all());
});

router.post('/api/filings', requirePermission('filing:create'), (req, res) => {
  const db = getDb();
  const { system_id, filing_number, filing_authority, filing_date, filing_status, filing_document, remarks } = req.body;
  const result = db.prepare('INSERT INTO filings (system_id, filing_number, filing_authority, filing_date, filing_status, filing_document, remarks) VALUES (?,?,?,?,?,?,?)')
    .run(system_id, filing_number, filing_authority, filing_date, filing_status || 'preparing', filing_document, remarks);
  if (filing_status === 'approved') {
    db.prepare("UPDATE systems SET status='filed', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(system_id);
  }
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'create', 'filing', 'system', String(system_id), `备案: ${filing_number}`);
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/api/filings/:id', requirePermission('filing:edit'), (req, res) => {
  const db = getDb();
  const { filing_number, filing_authority, filing_date, approval_date, filing_status, filing_document, remarks } = req.body;
  db.prepare('UPDATE filings SET filing_number=?, filing_authority=?, filing_date=?, approval_date=?, filing_status=?, filing_document=?, remarks=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(filing_number, filing_authority, filing_date, approval_date, filing_status, filing_document, remarks, req.params.id);
  if (filing_status === 'approved') {
    const filing = db.prepare('SELECT system_id FROM filings WHERE id=?').get(req.params.id);
    if (filing) db.prepare("UPDATE systems SET status='filed', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(filing.system_id);
  }
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'update', 'filing', 'filing', req.params.id, `更新备案状态: ${filing_status}`);
  res.json({ success: true });
});

// ===================== 差距分析 =====================
router.get('/api/gap-analyses', requirePermission('gap:view'), (req, res) => {
  const db = getDb();
  const { system_id } = req.query;
  let sql = 'SELECT g.*, s.name as system_name FROM gap_analyses g JOIN systems s ON g.system_id = s.id';
  const params = [];
  if (system_id) { sql += ' WHERE g.system_id=?'; params.push(system_id); }
  sql += ' ORDER BY g.analysis_date DESC';
  const analyses = db.prepare(sql).all(...params);
  for (const a of analyses) {
    a.items = db.prepare('SELECT * FROM gap_items WHERE analysis_id=? ORDER BY id').all(a.id);
  }
  res.json(analyses);
});

router.get('/api/gap-analyses/:id', requirePermission('gap:view'), (req, res) => {
  const db = getDb();
  const analysis = db.prepare('SELECT g.*, s.name as system_name FROM gap_analyses g JOIN systems s ON g.system_id = s.id WHERE g.id=?').get(req.params.id);
  if (!analysis) return res.status(404).json({ error: '未找到' });
  analysis.items = db.prepare('SELECT * FROM gap_items WHERE analysis_id=? ORDER BY id').all(analysis.id);
  res.json(analysis);
});

router.post('/api/gap-analyses', requirePermission('gap:create'), (req, res) => {
  const db = getDb();
  const { system_id, analysis_date, overall_score, compliance_rate, status, items } = req.body;
  const result = db.prepare('INSERT INTO gap_analyses (system_id, analysis_date, overall_score, compliance_rate, status) VALUES (?,?,?,?,?)')
    .run(system_id, analysis_date, overall_score, compliance_rate, status || 'draft');
  const analysisId = result.lastInsertRowid;
  if (items && items.length > 0) {
    const stmt = db.prepare('INSERT INTO gap_items (analysis_id, requirement_category, requirement_id, requirement_desc, expected_value, actual_value, is_compliant, risk_level, remarks) VALUES (?,?,?,?,?,?,?,?,?)');
    for (const item of items) { stmt.run(analysisId, item.requirement_category, item.requirement_id, item.requirement_desc, item.expected_value, item.actual_value, item.is_compliant ? 1 : 0, item.risk_level, item.remarks); }
  }
  db.prepare("UPDATE systems SET status='assessing', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(system_id);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'create', 'gap_analysis', 'system', String(system_id), `差距分析: 合规率${compliance_rate}%`);
  res.json({ id: analysisId });
});

// ===================== 整改管理 =====================
router.get('/api/rectifications', requirePermission('rectification:view'), (req, res) => {
  const db = getDb();
  const { system_id, status, priority } = req.query;
  let sql = 'SELECT r.*, s.name as system_name FROM rectifications r JOIN systems s ON r.system_id = s.id WHERE 1=1';
  const params = [];
  if (system_id) { sql += ' AND r.system_id=?'; params.push(system_id); }
  if (status) { sql += ' AND r.status=?'; params.push(status); }
  if (priority) { sql += ' AND r.priority=?'; params.push(priority); }
  sql += " ORDER BY CASE r.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END, r.plan_end_date ASC";
  res.json(db.prepare(sql).all(...params));
});

router.post('/api/rectifications', requirePermission('rectification:create'), (req, res) => {
  const db = getDb();
  const { system_id, gap_item_id, title, description, responsible_person, priority, plan_start_date, plan_end_date, cost, remarks } = req.body;
  const result = db.prepare('INSERT INTO rectifications (system_id, gap_item_id, title, description, responsible_person, priority, plan_start_date, plan_end_date, cost, remarks) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(system_id, gap_item_id, title, description, responsible_person, priority, plan_start_date, plan_end_date, cost || 0, remarks);
  db.prepare("UPDATE systems SET status='rectifying', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(system_id);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'create', 'rectification', 'system', String(system_id), `整改任务: ${title}`);
  res.json({ id: result.lastInsertRowid });
});

router.put('/api/rectifications/:id', requirePermission('rectification:edit'), (req, res) => {
  const db = getDb();
  const { title, description, responsible_person, priority, status, plan_start_date, plan_end_date, actual_start_date, actual_end_date, cost, evidence, remarks } = req.body;

  // 状态变更需要额外权限
  const old = db.prepare('SELECT status, title FROM rectifications WHERE id=?').get(req.params.id);
  if (old && old.status !== status && status) {
    // 验证状态变更权限
    const userPerms = db.prepare('SELECT permission_code FROM role_permissions WHERE role=?').all(req.user.role).map(p => p.permission_code);
    if (!userPerms.includes('rectification:status')) {
      return res.status(403).json({ error: '无权更改整改状态' });
    }
    auditLog(db, req.user.id, req.user.username, req.user.real_name, 'status_change', 'rectification', 'rectification', req.params.id, `整改状态: ${old.status} → ${status}`);
  }

  db.prepare('UPDATE rectifications SET title=?, description=?, responsible_person=?, priority=?, status=?, plan_start_date=?, plan_end_date=?, actual_start_date=?, actual_end_date=?, cost=?, evidence=?, remarks=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(title, description, responsible_person, priority, status, plan_start_date, plan_end_date, actual_start_date, actual_end_date, cost, evidence, remarks, req.params.id);
  res.json({ success: true });
});

// ===================== 整改证据截图 =====================
// 上传整改截图
router.post('/api/rectifications/:id/evidences', requirePermission('rectification:edit'), upload.single('file'), (req, res) => {
  const db = getDb();
  const rectId = req.params.id;
  const rect = db.prepare('SELECT id FROM rectifications WHERE id=?').get(rectId);
  if (!rect) return res.status(404).json({ error: '整改任务不存在' });

  if (!req.file) return res.status(400).json({ error: '请选择截图文件' });

  const result = db.prepare('INSERT INTO rectification_evidences (rectification_id, filename, original_name, file_size, mime_type, uploaded_by) VALUES (?,?,?,?,?,?)')
    .run(rectId, req.file.filename, req.file.originalname, req.file.size, req.file.mimetype, req.user.real_name || req.user.username);

  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'upload_evidence', 'rectification', 'rectification', rectId, `上传整改截图: ${req.file.originalname}`);
  res.json({ id: result.lastInsertRowid, filename: req.file.filename, original_name: req.file.originalname, file_size: req.file.size, uploaded_by: req.user.real_name || req.user.username, uploaded_at: new Date().toISOString() });
});

// 查看整改截图列表
router.get('/api/rectifications/:id/evidences', requirePermission('rectification:view'), (req, res) => {
  const db = getDb();
  const rectId = req.params.id;
  const evidences = db.prepare('SELECT * FROM rectification_evidences WHERE rectification_id=? ORDER BY uploaded_at DESC').all(rectId);
  res.json(evidences);
});

// 下载/查看整改截图 (支持 ?token=xxx 方式，用于 <img> 标签)
router.get('/api/rectifications/:id/evidences/:eid/file', (req, res) => {
  // 优先从 query 取 token，兼容 <img> 标签无法传 Authorization header
  const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未提供认证令牌' });
  
  const db = getDb();
  const session = db.prepare("SELECT * FROM sessions WHERE token=? AND expires_at > datetime('now')").get(token);
  if (!session) return res.status(401).json({ error: '令牌无效或已过期' });
  const evidence = db.prepare('SELECT * FROM rectification_evidences WHERE id=? AND rectification_id=?').get(req.params.eid, req.params.id);
  if (!evidence) return res.status(404).json({ error: '截图不存在' });

  const filePath = path.join(uploadDir, evidence.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });

  res.setHeader('Content-Type', evidence.mime_type || 'image/png');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(evidence.original_name)}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(filePath).pipe(res);
});

// 删除整改截图
router.delete('/api/rectifications/:id/evidences/:eid', requirePermission('rectification:edit'), (req, res) => {
  const db = getDb();
  const evidence = db.prepare('SELECT * FROM rectification_evidences WHERE id=? AND rectification_id=?').get(req.params.eid, req.params.id);
  if (!evidence) return res.status(404).json({ error: '截图不存在' });

  const filePath = path.join(uploadDir, evidence.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM rectification_evidences WHERE id=?').run(req.params.eid);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'delete_evidence', 'rectification', 'rectification', req.params.id, `删除整改截图: ${evidence.original_name}`);
  res.json({ success: true });
});

// ===================== 测评管理 =====================
router.get('/api/assessments', requirePermission('assessment:view'), (req, res) => {
  const db = getDb();
  const { system_id } = req.query;
  let sql = 'SELECT a.*, s.name as system_name FROM assessments a JOIN systems s ON a.system_id = s.id';
  const params = [];
  if (system_id) { sql += ' WHERE a.system_id=?'; params.push(system_id); }
  sql += ' ORDER BY a.assessment_date DESC';
  const assessments = db.prepare(sql).all(...params);
  for (const a of assessments) { a.items = db.prepare('SELECT * FROM assessment_items WHERE assessment_id=? ORDER BY id').all(a.id); }
  res.json(assessments);
});

router.post('/api/assessments', requirePermission('assessment:create'), (req, res) => {
  const db = getDb();
  const { system_id, assessment_agency, assessment_type, assessment_date, overall_score, overall_level, conclusion, report_number, assessment_report, status, items } = req.body;
  const result = db.prepare('INSERT INTO assessments (system_id, assessment_agency, assessment_type, assessment_date, overall_score, overall_level, conclusion, report_number, assessment_report, status) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(system_id, assessment_agency, assessment_type, assessment_date, overall_score, overall_level, conclusion, report_number, assessment_report, status || 'planned');
  const assessmentId = result.lastInsertRowid;
  if (items && items.length > 0) {
    const stmt = db.prepare('INSERT INTO assessment_items (assessment_id, category, control_id, control_desc, score, max_score, result, remarks) VALUES (?,?,?,?,?,?,?,?)');
    for (const item of items) { stmt.run(assessmentId, item.category, item.control_id, item.control_desc, item.score, item.max_score, item.result, item.remarks); }
  }
  if (status === 'completed') {
    db.prepare("UPDATE systems SET status='completed', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(system_id);
  }
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'create', 'assessment', 'system', String(system_id), `测评: 得分${overall_score}, 结论${conclusion}`);
  res.json({ id: assessmentId });
});

// ===================== 文档管理 =====================
router.get('/api/documents', requirePermission('document:view'), (req, res) => {
  const db = getDb();
  const { system_id, doc_type } = req.query;
  let sql = 'SELECT d.*, s.name as system_name FROM documents d LEFT JOIN systems s ON d.system_id = s.id WHERE 1=1';
  const params = [];
  if (system_id) { sql += ' AND d.system_id=?'; params.push(system_id); }
  if (doc_type) { sql += ' AND d.doc_type=?'; params.push(doc_type); }
  sql += ' ORDER BY d.uploaded_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/api/documents', requirePermission('document:upload'), upload.single('file'), (req, res) => {
  const db = getDb();
  const { system_id, title, doc_type, version, description } = req.body;
  const uploaded_by = req.user.real_name || req.user.username;
  const fileInfo = req.file ? { path: req.file.filename, size: req.file.size } : { path: null, size: 0 };
  const result = db.prepare('INSERT INTO documents (system_id, title, doc_type, file_path, file_size, version, description, uploaded_by) VALUES (?,?,?,?,?,?,?,?)')
    .run(system_id || null, title, doc_type, fileInfo.path, fileInfo.size, version || '1.0', description, uploaded_by);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'upload', 'document', 'document', String(result.lastInsertRowid), `上传文档: ${title}`);
  res.json({ id: result.lastInsertRowid, ...req.body, uploaded_by });
});

router.put('/api/documents/:id', requirePermission('document:edit'), (req, res) => {
  const db = getDb();
  const { title, doc_type, version, status, description } = req.body;
  db.prepare('UPDATE documents SET title=?, doc_type=?, version=?, status=?, description=? WHERE id=?')
    .run(title, doc_type, version, status, description, req.params.id);
  res.json({ success: true });
});

router.delete('/api/documents/:id', requirePermission('document:delete'), (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT title FROM documents WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM documents WHERE id=?').run(req.params.id);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'delete', 'document', 'document', req.params.id, `删除文档: ${doc?.title}`);
  res.json({ success: true });
});

router.get('/api/documents/:id/download', (req, res) => {
  // 支持 ?token= 查询参数（浏览器 <a> 标签无法传 Authorization header）
  const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未提供认证令牌' });

  const db = getDb();
  // 验证 token
  let userId = null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    userId = decoded.id;
  } catch (_) {
    const session = db.prepare("SELECT user_id FROM sessions WHERE token=? AND expires_at > datetime('now')").get(token);
    if (session) userId = session.user_id;
  }
  if (!userId) return res.status(401).json({ error: '令牌无效或已过期' });
  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
  if (!doc || !doc.file_path) return res.status(404).json({ error: '文件不存在' });
  const filePath = path.join(uploadDir, doc.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
  res.download(filePath, doc.title + path.extname(doc.file_path));
});

// ===================== 用户管理 =====================
router.get('/api/users', requirePermission('user:view'), (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, real_name, role, department, phone, email, status, last_login, login_type, ldap_dn FROM users ORDER BY id').all();
  res.json(users);
});

router.post('/api/users', requirePermission('user:create'), (req, res) => {
  const db = getDb();
  const { username, password, real_name, role, department, phone, email, login_type, ldap_dn } = req.body;
  if (!username || !password || !real_name || !role) return res.status(400).json({ error: '缺少必填字段' });

  // 检查用户名唯一性
  const exists = db.prepare('SELECT id FROM users WHERE username=?').get(username);
  if (exists) return res.status(400).json({ error: '用户名已存在' });

  const result = db.prepare('INSERT INTO users (username, password, real_name, role, department, phone, email, login_type, ldap_dn) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(username, bcrypt.hashSync(password, 10), real_name, role, department, phone, email, login_type || "local", ldap_dn || null);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'create', 'user', 'user', String(result.lastInsertRowid), `创建用户: ${username} (${role})`);
  res.json({ id: result.lastInsertRowid, username, real_name, role });
});

router.put('/api/users/:id', requirePermission('user:edit'), (req, res) => {
  const db = getDb();
  const { real_name, role, department, phone, email, status, login_type, ldap_dn } = req.body;
  const user = db.prepare('SELECT username FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  db.prepare('UPDATE users SET real_name=?, role=?, department=?, phone=?, email=?, status=?, login_type=COALESCE(?, login_type), ldap_dn=COALESCE(?, ldap_dn), updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(real_name, role, department, phone, email, status, login_type || null, ldap_dn || null, req.params.id);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'update', 'user', 'user', req.params.id, `修改用户: ${user.username}`);
  res.json({ success: true });
});

router.post('/api/users/:id/reset-password', requirePermission('user:reset_password'), (req, res) => {
  const db = getDb();
  const { new_password } = req.body;
  if (!new_password) return res.status(400).json({ error: '请输入新密码' });
  const user = db.prepare('SELECT username FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  db.prepare('UPDATE users SET password=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(bcrypt.hashSync(new_password, 10), req.params.id);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'reset_password', 'user', 'user', req.params.id, `重置密码: ${user.username}`);
  res.json({ success: true });
});

router.delete('/api/users/:id', requirePermission('user:delete'), (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT username FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'delete', 'user', 'user', req.params.id, `删除用户: ${user.username}`);
  res.json({ success: true });
});

// ===================== 权限管理 =====================
router.get('/api/permissions', requirePermission('permission:view'), (req, res) => {
  const db = getDb();
  const permissions = db.prepare('SELECT * FROM permissions ORDER BY module, id').all();
  // 获取每个角色的权限
  const rolePerms = {};
  const rows = db.prepare('SELECT role, permission_code FROM role_permissions').all();
  for (const r of rows) {
    if (!rolePerms[r.role]) rolePerms[r.role] = new Set();
    rolePerms[r.role].add(r.permission_code);
  }
  // 按模块分组
  const modules = {};
  for (const p of permissions) {
    if (!modules[p.module]) modules[p.module] = { name: p.module, permissions: [] };
    p.roles = {};
    for (const role of ['system_admin', 'security_admin', 'security_auditor', 'operator', 'viewer']) {
      p.roles[role] = rolePerms[role]?.has(p.code) || false;
    }
    modules[p.module].permissions.push(p);
  }
  res.json({ modules: Object.values(modules), roles: ['system_admin', 'security_admin', 'security_auditor', 'operator', 'viewer'] });
});

router.put('/api/permissions', requirePermission('permission:manage'), (req, res) => {
  const db = getDb();
  const { role, permissions } = req.body;
  if (!role) return res.status(400).json({ error: '缺少角色参数' });

  db.prepare('DELETE FROM role_permissions WHERE role=?').run(role);
  if (permissions && permissions.length > 0) {
    const stmt = db.prepare('INSERT INTO role_permissions (role, permission_code) VALUES (?,?)');
    for (const code of permissions) {
      stmt.run(role, code);
    }
  }
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'manage_permissions', 'permission', 'role', role, `更新角色权限: ${permissions?.length || 0} 项`);
  res.json({ success: true });
});

// ===================== 审计日志 =====================
router.get('/api/audit-logs', requirePermission('audit:view'), (req, res) => {
  const db = getDb();
  const { user_id, action, module, start_date, end_date, page, page_size } = req.query;
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  if (user_id) { sql += ' AND user_id=?'; params.push(user_id); }
  if (action) { sql += ' AND action=?'; params.push(action); }
  if (module) { sql += ' AND module=?'; params.push(module); }
  if (start_date) { sql += ' AND created_at >= ?'; params.push(start_date); }
  if (end_date) { sql += ' AND created_at <= ?'; params.push(end_date + ' 23:59:59'); }

  // 总数
  const total = db.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as cnt')).get(...params).cnt;

  // 分页
  const p = parseInt(page) || 1;
  const ps = parseInt(page_size) || 50;
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(ps, (p - 1) * ps);

  const logs = db.prepare(sql).all(...params);
  res.json({ total, page: p, page_size: ps, data: logs });
});

router.get('/api/audit-logs/export', requirePermission('audit:export'), (req, res) => {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10000').all();
  const csv = ['ID,用户,操作,模块,目标类型,目标ID,详情,结果,时间']
    .concat(logs.map(l => `${l.id},"${l.real_name || l.username}","${l.action}","${l.module}","${l.target_type}","${l.target_id}","${(l.detail || '').replace(/"/g, '""')}","${l.result}","${l.created_at}"`))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=audit_log_${new Date().toISOString().slice(0,10)}.csv`);
  res.send('\uFEFF' + csv); // BOM for Excel
});

// ===================== 系统配置 (LDAP/域控) =====================
router.get('/api/settings', requirePermission('permission:view'), (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value, description FROM settings ORDER BY key').all();
  const result = {};
  for (const r of rows) result[r.key] = { value: r.value, description: r.description };
  res.json(result);
});

router.put('/api/settings', requirePermission('permission:manage'), (req, res) => {
  const db = getDb();
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') return res.status(400).json({ error: '参数格式错误' });
  
  const stmt = db.prepare('UPDATE settings SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key=?');
  for (const [key, value] of Object.entries(settings)) {
    stmt.run(String(value), key);
  }
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'update_settings', 'settings', 'settings', null, '更新系统配置');
  res.json({ success: true });
});

module.exports = router;
