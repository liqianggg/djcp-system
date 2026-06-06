const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const { getDb } = require('../database');
const { requirePermission, auditLog, verifyToken } = require('../middleware/auth');
const { ldapAuthenticate, ldapTestConnection } = require('../services/ldap');

const router = express.Router();

// Upload config
function getUploadDir() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key='upload_path'").get();
    const configured = row?.value || 'uploads';
    const dir = path.isAbsolute(configured) ? configured : path.join(__dirname, '..', '..', configured);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch (_) {
    const dir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, getUploadDir()),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Mount extracted route modules
router.use(require('./auth'));
router.use(require('./dashboard'));
router.use(require('./systems'));
router.use(require('./classifications'));
router.use(require('./permissions'));
router.use(require('./auditLogs'));
router.use(require('./settings'));

// ===================== 差距分析文件导入 =====================
router.post('/api/gap-analyses/import', requirePermission('gap:create'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传文件' });
  const db = getDb();
  let items = [];
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filePath = path.join(getUploadDir(), req.file.filename);
    if (ext === '.csv') {
      const csvData = fs.readFileSync(filePath, 'utf8');
      const rows = csvData.split('\n').filter(line => line.trim());
      const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      for (let i = 1; i < rows.length; i++) {
        const vals = rows[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row = {};
        headers.forEach((h, j) => { row[h] = vals[j] || ''; });
        if (Object.values(row).some(v => v)) items.push(row);
      }
    } else {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      items = data;
    }
    const colMap = {
      '类别': 'requirement_category', 'category': 'requirement_category', '安全类别': 'requirement_category',
      '编号': 'requirement_id', 'id': 'requirement_id', '要求编号': 'requirement_id', '控制点编号': 'requirement_id',
      '描述': 'requirement_desc', 'desc': 'requirement_desc', '要求描述': 'requirement_desc', '要求项': 'requirement_desc', '控制点': 'requirement_desc',
      '期望值': 'expected_value', 'expected': 'expected_value', '期望': 'expected_value', '应满足的要求': 'expected_value',
      '实际值': 'actual_value', 'actual': 'actual_value', '实际情况': 'actual_value', '现状': 'actual_value',
      '风险等级': 'risk_level', 'risk': 'risk_level', '风险': 'risk_level',
      '符合': 'is_compliant', 'compliant': 'is_compliant', '是否合规': 'is_compliant',
      '备注': 'remarks', 'remark': 'remarks', '说明': 'remarks',
    };
    const result = items.map(row => {
      const item = { requirement_category: '', requirement_id: '', requirement_desc: '', expected_value: '', actual_value: '', risk_level: 'medium', is_compliant: 0, remarks: '' };
      for (const [key, val] of Object.entries(row)) {
        const mapped = colMap[key.trim()] || colMap[key.trim().toLowerCase()];
        if (mapped) {
          if (mapped === 'is_compliant') {
            const v = String(val).toLowerCase();
            item[mapped] = (v === '是' || v === 'yes' || v === 'true' || v === '1' || v === '符合') ? 1 : 0;
          } else {
            item[mapped] = String(val);
          }
        }
      }
      return item;
    }).filter(item => item.requirement_category || item.requirement_id);
    try { fs.unlinkSync(filePath); } catch (_) {}
    auditLog(db, req.user.id, req.user.username, req.user.real_name, 'import', 'gap_analysis', 'file', null, `导入差距分析文件: ${req.file.originalname}, 识别 ${result.length} 项`);
    res.json({ success: true, count: result.length, items: result });
  } catch (e) {
    try { fs.unlinkSync(path.join(getUploadDir(), req.file.filename)); } catch (_) {}
    res.status(400).json({ error: '文件解析失败: ' + e.message });
  }
});

// ===================== 备案管理 =====================
router.get('/api/filings/years', requirePermission('filing:view'), (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT filing_year FROM filings ORDER BY filing_year DESC').all();
  res.json(rows.map(r => r.filing_year));
});

router.get('/api/filings', requirePermission('filing:view'), (req, res) => {
  const db = getDb();
  const { year, status } = req.query;
  let sql = 'SELECT f.*, s.name as system_name, (SELECT COUNT(*) FROM filing_evidences WHERE filing_id=f.id) as proof_image_count FROM filings f JOIN systems s ON f.system_id=s.id WHERE 1=1';
  const params = [];
  if (year) { sql += ' AND f.filing_year=?'; params.push(year); }
  if (status) { sql += ' AND f.filing_status=?'; params.push(status); }
  sql += ' ORDER BY f.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/api/filings', requirePermission('filing:create'), (req, res) => {
  const db = getDb();
  const { system_id, filing_number, filing_authority, filing_date, filing_status, filing_document, filing_year, remarks } = req.body;
  const result = db.prepare('INSERT INTO filings (system_id, filing_number, filing_authority, filing_date, filing_status, filing_document, filing_year, remarks) VALUES (?,?,?,?,?,?,?,?)')
    .run(system_id, filing_number, filing_authority, filing_date, filing_status || 'preparing', filing_document, filing_year || new Date().getFullYear(), remarks);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'create', 'filing', 'filing', String(result.lastInsertRowid), `创建备案: ${filing_number}`);
  if (filing_status === 'approved') {
    db.prepare("UPDATE systems SET status='filed', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(system_id);
  }
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/api/filings/:id', requirePermission('filing:edit'), (req, res) => {
  const db = getDb();
  const { filing_number, filing_authority, filing_date, approval_date, filing_status, filing_document, filing_year, remarks } = req.body;
  db.prepare('UPDATE filings SET filing_number=?, filing_authority=?, filing_date=?, approval_date=?, filing_status=?, filing_document=?, filing_year=?, remarks=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(filing_number, filing_authority, filing_date, approval_date, filing_status, filing_document, filing_year, remarks, req.params.id);
  if (filing_status === 'approved') {
    const f = db.prepare('SELECT system_id FROM filings WHERE id=?').get(req.params.id);
    if (f) db.prepare("UPDATE systems SET status='filed', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(f.system_id);
  }
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'update', 'filing', 'filing', req.params.id, `编辑备案: ${filing_number}`);
  res.json({ success: true });
});

// 备案证明图片
router.post('/api/filings/:id/evidences', requirePermission('filing:edit'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' });
  const db = getDb();
  db.prepare('INSERT INTO filing_evidences (filing_id, file_path, original_name, file_size, uploaded_by) VALUES (?,?,?,?,?)')
    .run(req.params.id, req.file.filename, req.file.originalname, req.file.size, req.user.real_name);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'upload', 'filing', 'filing', req.params.id, `上传备案证明: ${req.file.originalname}`);
  res.json({ success: true, filename: req.file.filename });
});

router.get('/api/filings/:id/evidences', requirePermission('filing:view'), (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM filing_evidences WHERE filing_id=? ORDER BY uploaded_at DESC').all(req.params.id));
});

router.get('/api/filings/:id/evidences/:eid/file', (req, res) => {
  const userInfo = verifyToken(req);
  if (!userInfo) return res.status(401).json({ error: '未提供认证令牌' });
  const db = getDb();
  const ev = db.prepare('SELECT * FROM filing_evidences WHERE id=? AND filing_id=?').get(req.params.eid, req.params.id);
  if (!ev) return res.status(404).json({ error: '文件不存在' });
  const filePath = path.join(getUploadDir(), ev.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
  res.sendFile(filePath);
});

router.delete('/api/filings/:id/evidences/:eid', requirePermission('filing:edit'), (req, res) => {
  const db = getDb();
  const ev = db.prepare('SELECT * FROM filing_evidences WHERE id=? AND filing_id=?').get(req.params.eid, req.params.id);
  if (ev) {
    try { fs.unlinkSync(path.join(getUploadDir(), ev.file_path)); } catch (_) {}
    db.prepare('DELETE FROM filing_evidences WHERE id=?').run(req.params.eid);
  }
  res.json({ success: true });
});

// ===================== 差距分析 =====================
router.get('/api/gap-analyses', requirePermission('gap:view'), (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT g.*, s.name as system_name FROM gap_analyses g JOIN systems s ON g.system_id=s.id ORDER BY g.created_at DESC').all();
  res.json(rows);
});

router.get('/api/gap-analyses/:id', requirePermission('gap:view'), (req, res) => {
  const db = getDb();
  const analysis = db.prepare('SELECT g.*, s.name as system_name FROM gap_analyses g JOIN systems s ON g.system_id=s.id WHERE g.id=?').get(req.params.id);
  if (!analysis) return res.status(404).json({ error: '差距分析不存在' });
  const items = db.prepare('SELECT * FROM gap_items WHERE analysis_id=? ORDER BY id').all(req.params.id);
  res.json({ ...analysis, items });
});

router.post('/api/gap-analyses', requirePermission('gap:create'), (req, res) => {
  const db = getDb();
  const { system_id, analysis_date, overall_score, compliance_rate, status, items } = req.body;
  const result = db.prepare('INSERT INTO gap_analyses (system_id, analysis_date, overall_score, compliance_rate, status) VALUES (?,?,?,?,?)')
    .run(system_id, analysis_date, overall_score, compliance_rate, status || 'draft');
  const analysisId = result.lastInsertRowid;
  if (items && items.length > 0) {
    const stmt = db.prepare('INSERT INTO gap_items (analysis_id, requirement_category, requirement_id, requirement_desc, expected_value, actual_value, is_compliant, risk_level, remarks) VALUES (?,?,?,?,?,?,?,?,?)');
    for (const item of items) {
      stmt.run(analysisId, item.requirement_category, item.requirement_id, item.requirement_desc, item.expected_value, item.actual_value, item.is_compliant ? 1 : 0, item.risk_level || 'medium', item.remarks);
    }
  }
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'create', 'gap_analysis', 'gap_analysis', String(analysisId), `创建差距分析`);
  res.json({ id: analysisId });
});

// ===================== 整改管理 =====================
router.get('/api/rectifications', requirePermission('rectification:view'), (req, res) => {
  const db = getDb();
  const { status, my_tasks } = req.query;
  let sql = 'SELECT r.*, s.name as system_name FROM rectifications r JOIN systems s ON r.system_id=s.id WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND r.status=?'; params.push(status); }
  if (my_tasks === '1' && req.user) {
    sql += ' AND (r.responsible_person_id=? OR r.id IN (SELECT rectification_id FROM rectification_assignees WHERE user_id=?))';
    params.push(req.user.id, req.user.id);
  }
  sql += ' ORDER BY r.created_at DESC';
  const rows = db.prepare(sql).all(...params);
  const result = rows.map(r => {
    const assignees = db.prepare('SELECT ra.*, u.real_name, u.username FROM rectification_assignees ra JOIN users u ON ra.user_id=u.id WHERE ra.rectification_id=?').all(r.id);
    const respName = r.responsible_person_id ? (db.prepare('SELECT real_name FROM users WHERE id=?').get(r.responsible_person_id)?.real_name) : null;
    return { ...r, responsible_person_name: respName || r.responsible_person, assignees };
  });
  res.json(result);
});

router.post('/api/rectifications', requirePermission('rectification:create'), (req, res) => {
  const db = getDb();
  const { system_id, gap_item_id, title, description, responsible_person, responsible_person_id, priority, plan_start_date, plan_end_date, cost, remarks, assignee_ids } = req.body;
  const result = db.prepare('INSERT INTO rectifications (system_id, gap_item_id, title, description, responsible_person, responsible_person_id, priority, plan_start_date, plan_end_date, cost, remarks) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(system_id, gap_item_id || null, title, description || null, responsible_person || null, responsible_person_id || null, priority || 'medium', plan_start_date || null, plan_end_date || null, cost || 0, remarks || null);
  if (assignee_ids && assignee_ids.length > 0) {
    const stmt = db.prepare('INSERT OR IGNORE INTO rectification_assignees (rectification_id, user_id) VALUES (?,?)');
    for (const uid of assignee_ids) stmt.run(result.lastInsertRowid, uid);
  }
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'create', 'rectification', 'rectification', String(result.lastInsertRowid), `创建整改任务: ${title}`);
  res.json({ id: result.lastInsertRowid });
});

router.put('/api/rectifications/:id', requirePermission('rectification:edit'), (req, res) => {
  const db = getDb();
  const { title, description, responsible_person, responsible_person_id, priority, status, plan_start_date, plan_end_date, actual_start_date, actual_end_date, cost, remarks, assignee_ids } = req.body;
  db.prepare(`UPDATE rectifications SET title=?, description=?, responsible_person=?, responsible_person_id=?, priority=?, status=?,
    plan_start_date=?, plan_end_date=?, actual_start_date=?, actual_end_date=?, cost=?, remarks=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(title, description, responsible_person, responsible_person_id || null, priority, status, plan_start_date, plan_end_date, actual_start_date, actual_end_date, cost || 0, remarks, req.params.id);
  if (assignee_ids !== undefined) {
    db.prepare('DELETE FROM rectification_assignees WHERE rectification_id=?').run(req.params.id);
    if (assignee_ids.length > 0) {
      const stmt = db.prepare('INSERT OR IGNORE INTO rectification_assignees (rectification_id, user_id) VALUES (?,?)');
      for (const uid of assignee_ids) stmt.run(req.params.id, uid);
    }
  }
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'update', 'rectification', 'rectification', req.params.id, `更新整改任务: ${title}`);
  res.json({ success: true });
});

// 整改证据截图
router.post('/api/rectifications/:id/evidences', requirePermission('rectification:edit'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' });
  const db = getDb();
  db.prepare('INSERT INTO rectification_evidences (rectification_id, file_path, original_name, file_size, uploaded_by) VALUES (?,?,?,?,?)')
    .run(req.params.id, req.file.filename, req.file.originalname, req.file.size, req.user.real_name);
  res.json({ success: true, filename: req.file.filename });
});

router.get('/api/rectifications/:id/evidences', requirePermission('rectification:view'), (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM rectification_evidences WHERE rectification_id=? ORDER BY uploaded_at DESC').all(req.params.id));
});

router.get('/api/rectifications/:id/evidences/:eid/file', (req, res) => {
  const userInfo = verifyToken(req);
  if (!userInfo) return res.status(401).json({ error: '未提供认证令牌' });
  const db = getDb();
  const ev = db.prepare('SELECT * FROM rectification_evidences WHERE id=? AND rectification_id=?').get(req.params.eid, req.params.id);
  if (!ev) return res.status(404).json({ error: '文件不存在' });
  const filePath = path.join(getUploadDir(), ev.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
  res.sendFile(filePath);
});

router.delete('/api/rectifications/:id/evidences/:eid', requirePermission('rectification:edit'), (req, res) => {
  const db = getDb();
  const ev = db.prepare('SELECT * FROM rectification_evidences WHERE id=? AND rectification_id=?').get(req.params.eid, req.params.id);
  if (ev) {
    try { fs.unlinkSync(path.join(getUploadDir(), ev.file_path)); } catch (_) {}
    db.prepare('DELETE FROM rectification_evidences WHERE id=?').run(req.params.eid);
  }
  res.json({ success: true });
});

// ===================== 测评机构管理 =====================
router.get('/api/agencies', requirePermission('agency:view'), (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM assessment_agencies ORDER BY name').all();
  res.json(rows);
});

router.get('/api/agencies/:id', requirePermission('agency:view'), (req, res) => {
  const db = getDb();
  const agency = db.prepare('SELECT * FROM assessment_agencies WHERE id=?').get(req.params.id);
  if (!agency) return res.status(404).json({ error: '机构不存在' });
  const records = db.prepare('SELECT r.*, s.name as system_name, s.id as system_id, u.real_name as client_contact_name FROM on_site_records r LEFT JOIN assessments a ON r.assessment_id=a.id LEFT JOIN systems s ON a.system_id=s.id LEFT JOIN users u ON r.client_contact_id=u.id WHERE r.agency_id=? ORDER BY r.entry_date DESC').all(req.params.id);
  res.json({ ...agency, records });
});

router.post('/api/agencies', requirePermission('agency:create'), (req, res) => {
  const db = getDb();
  const { name, qualification_level, qualification_number, qualification_expiry, address, phone, email, contact_person, contact_phone, contact_email, remarks } = req.body;
  const result = db.prepare('INSERT INTO assessment_agencies (name, qualification_level, qualification_number, qualification_expiry, address, phone, email, contact_person, contact_phone, contact_email, remarks) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(name, qualification_level, qualification_number, qualification_expiry, address, phone, email, contact_person, contact_phone, contact_email, remarks);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'create', 'agency', 'agency', String(result.lastInsertRowid), `创建测评机构: ${name}`);
  res.json({ id: result.lastInsertRowid });
});

router.put('/api/agencies/:id', requirePermission('agency:edit'), (req, res) => {
  const db = getDb();
  const { name, qualification_level, qualification_number, qualification_expiry, address, phone, email, contact_person, contact_phone, contact_email, remarks } = req.body;
  db.prepare('UPDATE assessment_agencies SET name=?, qualification_level=?, qualification_number=?, qualification_expiry=?, address=?, phone=?, email=?, contact_person=?, contact_phone=?, contact_email=?, remarks=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(name, qualification_level, qualification_number, qualification_expiry, address, phone, email, contact_person, contact_phone, contact_email, remarks, req.params.id);
  res.json({ success: true });
});

router.delete('/api/agencies/:id', requirePermission('agency:delete'), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM assessment_agencies WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// 进场测评记录
router.get('/api/agencies/:id/records', requirePermission('onsite:view'), (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT r.*, s.name as system_name, s.id as system_id, u.real_name as client_contact_name FROM on_site_records r LEFT JOIN assessments a ON r.assessment_id=a.id LEFT JOIN systems s ON a.system_id=s.id LEFT JOIN users u ON r.client_contact_id=u.id WHERE r.agency_id=? ORDER BY r.entry_date DESC').all(req.params.id);
  res.json(rows);
});

router.post('/api/agencies/:id/records', requirePermission('onsite:create'), (req, res) => {
  const db = getDb();
  const { assessment_id, entry_date, exit_date, assessment_personnel, client_contact_id, remarks } = req.body;
  const result = db.prepare('INSERT INTO on_site_records (agency_id, assessment_id, entry_date, exit_date, assessment_personnel, client_contact_id, remarks) VALUES (?,?,?,?,?,?,?)')
    .run(req.params.id, assessment_id || null, entry_date, exit_date, assessment_personnel, client_contact_id || null, remarks);
  res.json({ id: result.lastInsertRowid });
});

router.put('/api/agencies/:id/records/:rid', requirePermission('onsite:edit'), (req, res) => {
  const db = getDb();
  const { assessment_id, entry_date, exit_date, assessment_personnel, client_contact_id, remarks } = req.body;
  db.prepare('UPDATE on_site_records SET assessment_id=?, entry_date=?, exit_date=?, assessment_personnel=?, client_contact_id=?, remarks=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND agency_id=?')
    .run(assessment_id || null, entry_date, exit_date, assessment_personnel, client_contact_id || null, remarks, req.params.rid, req.params.id);
  res.json({ success: true });
});

router.delete('/api/agencies/:id/records/:rid', requirePermission('onsite:delete'), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM on_site_records WHERE id=? AND agency_id=?').run(req.params.rid, req.params.id);
  res.json({ success: true });
});

// ===================== 测评管理 =====================
router.get('/api/assessments', requirePermission('assessment:view'), (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT a.*, s.name as system_name FROM assessments a JOIN systems s ON a.system_id=s.id ORDER BY a.created_at DESC').all();
  res.json(rows);
});

router.post('/api/assessments', requirePermission('assessment:create'), (req, res) => {
  const db = getDb();
  const { system_id, assessment_agency, agency_id, assessment_type, assessment_date, overall_score, overall_level, conclusion, report_number, assessment_report, status, items } = req.body;
  const result = db.prepare('INSERT INTO assessments (system_id, assessment_agency, agency_id, assessment_type, assessment_date, overall_score, overall_level, conclusion, report_number, assessment_report, status) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(system_id, assessment_agency, agency_id || null, assessment_type || 'initial', assessment_date, overall_score || 0, overall_level, conclusion || 'pass', report_number, assessment_report, status || 'planned');
  const assessmentId = result.lastInsertRowid;
  if (items && items.length > 0) {
    const stmt = db.prepare('INSERT INTO assessment_items (assessment_id, category, control_id, control_desc, score, max_score, result, remarks) VALUES (?,?,?,?,?,?,?,?)');
    for (const item of items) {
      stmt.run(assessmentId, item.category, item.control_id, item.control_desc, item.score || 0, item.max_score || 5, item.result || '不符合', item.remarks);
    }
  }
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'create', 'assessment', 'assessment', String(assessmentId), `创建测评记录`);
  res.json({ id: assessmentId });
});

// 测评报告 PDF 导出
router.get('/api/assessments/:id/report', requirePermission('assessment:view'), (req, res) => {
  const db = getDb();
  const a = db.prepare('SELECT a.*, s.name as system_name, s.code as system_code FROM assessments a JOIN systems s ON a.system_id=s.id WHERE a.id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: '测评记录不存在' });
  const items = db.prepare('SELECT * FROM assessment_items WHERE assessment_id=? ORDER BY id').all(req.params.id);

  const FONT_PATH = '/Library/Fonts/Arial Unicode.ttf';
  const typeLabels = { initial: '初次测评', reassessment: '复评', annual: '年度测评' };
  const conclLabels = { pass: '通过', conditional_pass: '有条件通过', fail: '未通过' };
  const scoreRate = items.length > 0 ? (items.reduce((s, i) => s + i.score, 0) / items.reduce((s, i) => s + i.max_score, 0) * 100) : 0;

  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    const filename = `测评报告-${a.system_name}-${new Date().toISOString().slice(0, 10)}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename + '.pdf')}`);
    res.send(Buffer.concat(chunks));
  });
  doc.on('error', () => res.status(500).json({ error: 'PDF 生成失败' }));

  doc.registerFont('CJK', FONT_PATH);
  doc.font('CJK');

  const drawLine = () => { doc.moveDown(0.3).strokeColor('#d1d5db').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.6); };

  doc.fontSize(20).fillColor('#1a56db').text('网络安全等级保护测评报告', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor('#666').text('报告编号: DJCP-AS-' + String(a.id).padStart(4, '0') + '  |  生成日期: ' + new Date().toISOString().slice(0, 10), { align: 'center' });
  doc.moveDown(0.8);

  drawLine();
  doc.fontSize(15).fillColor('#1a56db').text('一、基本信息').moveDown(0.3);
  const info = [
    ['系统名称', a.system_name], ['系统编号', a.system_code || '-'],
    ['测评机构', a.assessment_agency || '-'], ['测评类型', typeLabels[a.assessment_type] || a.assessment_type],
    ['测评日期', a.assessment_date || '-'], ['报告编号', a.report_number || '-']
  ];
  info.forEach(([label, value]) => {
    const y = doc.y;
    doc.fontSize(11).fillColor('#333').text(label, 50, y, { width: 120 });
    doc.fillColor('#000').text(value || '-', 170, y, { width: 370 });
    doc.moveDown(0.15);
  });
  doc.moveDown(0.3);

  drawLine();
  doc.fontSize(15).fillColor('#1a56db').text('二、测评结果').moveDown(0.3);
  const resultInfo = [
    ['总得分', `${a.overall_score} / ${items.reduce((s, i) => s + i.max_score, 0)}`],
    ['得分率', `${scoreRate.toFixed(1)}%`],
    ['等保级别', a.overall_level || '-'],
    ['测评结论', conclLabels[a.conclusion] || a.conclusion],
    ['测评状态', a.status === 'completed' ? '已完成' : a.status === 'in_progress' ? '进行中' : '计划中']
  ];
  resultInfo.forEach(([label, value]) => {
    const y = doc.y;
    doc.fontSize(11).fillColor('#333').text(label, 50, y, { width: 120 });
    doc.fillColor('#000').text(value, 170, y, { width: 370 });
    doc.moveDown(0.15);
  });
  doc.moveDown(0.5);

  drawLine();
  doc.fontSize(15).fillColor('#1a56db').text('三、测评项明细').moveDown(0.3);

  // Group by category
  const cats = {};
  items.forEach(i => {
    if (!cats[i.category]) cats[i.category] = [];
    cats[i.category].push(i);
  });
  Object.entries(cats).forEach(([cat, catItems]) => {
    doc.fontSize(13).fillColor('#333').text(cat + ` (得分 ${catItems.reduce((s, i) => s + i.score, 0)}/${catItems.reduce((s, i) => s + i.max_score, 0)})`).moveDown(0.15);
    catItems.forEach(i => {
      const y = doc.y;
      doc.fontSize(10).fillColor('#333').text(`[${i.control_id}] ${i.control_desc}`, 60, y, { width: 280 });
      doc.fillColor('#000').text(`${i.score}/${i.max_score}`, 350, y, { width: 60 });
      doc.fillColor(i.result === '符合' ? '#16a34a' : i.result === '部分符合' ? '#d97706' : '#dc2626')
        .text(i.result, 420, y, { width: 80 });
      doc.moveDown(0.08);
    });
    doc.moveDown(0.2);
  });

  drawLine();
  doc.fontSize(15).fillColor('#1a56db').text('四、测评报告摘要').moveDown(0.3);
  doc.fontSize(11).fillColor('#000').text(a.assessment_report || '（无）', { align: 'justify' });

  doc.strokeColor('#d1d5db').lineWidth(0.5).moveTo(50, doc.y + 20).lineTo(545, doc.y + 20).stroke();
  doc.moveDown(1);
  doc.fontSize(10).fillColor('#999').text('报告生成时间: ' + new Date().toLocaleString('zh-CN'), { align: 'right' });
  doc.text('本报告由等保测评全生命周期管理系统自动生成', { align: 'right' });
  doc.end();
});

// ===================== 文档管理 =====================
router.get('/api/documents', requirePermission('document:view'), (req, res) => {
  const db = getDb();
  const { search, type } = req.query;
  let sql = 'SELECT d.*, s.name as system_name FROM documents d LEFT JOIN systems s ON d.system_id=s.id WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND d.title LIKE ?'; params.push(`%${search}%`); }
  if (type) { sql += ' AND d.doc_type=?'; params.push(type); }
  sql += ' ORDER BY d.uploaded_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/api/documents', requirePermission('document:upload'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' });
  const db = getDb();
  const { system_id, title, doc_type, version, description, keywords, status } = req.body;
  const result = db.prepare('INSERT INTO documents (system_id, title, doc_type, file_path, file_size, version, description, keywords, status, uploaded_by) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(system_id || null, title, doc_type || 'other', req.file.filename, req.file.size, version || '1.0', description, keywords, status || 'active', req.user.real_name);
  res.json({ id: result.lastInsertRowid });
});

router.put('/api/documents/:id', requirePermission('document:edit'), (req, res) => {
  const db = getDb();
  const { system_id, title, doc_type, version, description, keywords, status } = req.body;
  db.prepare('UPDATE documents SET system_id=?, title=?, doc_type=?, version=?, description=?, keywords=?, status=? WHERE id=?')
    .run(system_id || null, title, doc_type, version, description, keywords, status, req.params.id);
  res.json({ success: true });
});

router.post('/api/documents/:id/upload', requirePermission('document:upload'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' });
  const db = getDb();
  const doc = db.prepare('SELECT file_path FROM documents WHERE id=?').get(req.params.id);
  if (doc?.file_path) { try { fs.unlinkSync(path.join(getUploadDir(), doc.file_path)); } catch (_) {} }
  db.prepare('UPDATE documents SET file_path=?, file_size=? WHERE id=?').run(req.file.filename, req.file.size, req.params.id);
  res.json({ success: true });
});

router.get('/api/documents/:id/preview', (req, res) => {
  const userInfo = verifyToken(req);
  if (!userInfo) return res.status(401).json({ error: '未提供认证令牌' });
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
  if (!doc || !doc.file_path) return res.status(404).json({ error: '文件不存在' });
  const filePath = path.join(getUploadDir(), doc.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
  res.sendFile(filePath);
});

router.delete('/api/documents/:id', requirePermission('document:delete'), (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
  if (doc?.file_path) { try { fs.unlinkSync(path.join(getUploadDir(), doc.file_path)); } catch (_) {} }
  db.prepare('DELETE FROM documents WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

router.get('/api/documents/:id/download', (req, res) => {
  const userInfo = verifyToken(req);
  if (!userInfo) return res.status(401).json({ error: '未提供认证令牌' });
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
  if (!doc || !doc.file_path) return res.status(404).json({ error: '文件不存在' });
  const filePath = path.join(getUploadDir(), doc.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
  res.download(filePath, doc.title + path.extname(doc.file_path));
});

// ===================== 用户管理 =====================
router.get('/api/users/active', requirePermission(), (req, res) => {
  const db = getDb();
  res.json(db.prepare("SELECT id, username, real_name, role, department FROM users WHERE status='active' ORDER BY real_name").all());
});

router.get('/api/users', requirePermission('user:view'), (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT id, username, real_name, role, department, phone, email, status, login_type, last_login, created_at FROM users ORDER BY id').all());
});

router.post('/api/users', requirePermission('user:create'), (req, res) => {
  const db = getDb();
  const bcrypt = require('bcryptjs');
  const { username, password, real_name, role, department, phone, email, login_type, ldap_dn } = req.body;
  if (!username || !password || !real_name || !role) return res.status(400).json({ error: '缺少必填字段' });
  const existing = db.prepare('SELECT id FROM users WHERE username=?').get(username);
  if (existing) return res.status(400).json({ error: '用户名已存在' });
  const result = db.prepare('INSERT INTO users (username, password, real_name, role, department, phone, email, login_type, ldap_dn) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(username, bcrypt.hashSync(password, 10), real_name, role, department, phone, email, login_type || "local", ldap_dn || null);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'create', 'user', 'user', String(result.lastInsertRowid), `创建用户: ${username}`);
  res.json({ id: result.lastInsertRowid });
});

router.put('/api/users/:id', requirePermission('user:edit'), (req, res) => {
  const db = getDb();
  const { username, real_name, role, department, phone, email, status, login_type, ldap_dn } = req.body;
  db.prepare('UPDATE users SET username=?, real_name=?, role=?, department=?, phone=?, email=?, status=?, login_type=?, ldap_dn=? WHERE id=?')
    .run(username, real_name, role, department, phone, email, status, login_type, ldap_dn, req.params.id);
  res.json({ success: true });
});

router.post('/api/users/:id/reset-password', requirePermission('user:reset_password'), (req, res) => {
  const db = getDb();
  const bcrypt = require('bcryptjs');
  const { new_password } = req.body;
  if (!new_password) return res.status(400).json({ error: '请输入新密码' });
  const user = db.prepare('SELECT username FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(new_password, 10), req.params.id);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'reset_password', 'user', 'user', req.params.id, `重置密码: ${user.username}`);
  res.json({ success: true });
});

router.delete('/api/users/:id', requirePermission('user:delete'), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
