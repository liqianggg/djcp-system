const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getDb } = require('../database');
const { generateToken, requirePermission, auditLog } = require('../middleware/auth');
const { ldapAuthenticate } = require('../services/ldap');

router.post('/api/login', async (req, res) => {
  const { username, password, login_type } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: '请输入用户名和密码' });

  const db = getDb();
  let user = db.prepare('SELECT * FROM users WHERE username=?').get(username);

  if (login_type === 'ldap') {
    const ldapSettings = {};
    const settings = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'ldap_%'").all();
    settings.forEach(s => { ldapSettings[s.key] = s.value; });

    if (!ldapSettings.ldap_server) {
      return res.status(500).json({ success: false, message: 'LDAP 未配置' });
    }

    try {
      await ldapAuthenticate(username, password, ldapSettings);
    } catch (e) {
      auditLog(db, null, username, null, 'login', 'auth', 'user', null, '域控认证失败: ' + e.message, 'failure');
      return res.status(401).json({ success: false, message: e.message });
    }

    if (!user) {
      const defaultPassword = bcrypt.hashSync('Djcp@2026', 10);
      db.prepare('INSERT INTO users (username, password, real_name, role, department, login_type, status) VALUES (?,?,?,?,?,?,?)')
        .run(username, defaultPassword, username, 'viewer', '', 'ldap', 'active');
      user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
      auditLog(db, user.id, username, user.real_name, 'user_create', 'auth', 'user', String(user.id), '域控用户自动创建');
    }
  } else {
    if (!user) {
      auditLog(db, null, username, null, 'login', 'auth', 'user', null, '登录失败：用户名或密码错误', 'failure');
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    if (!bcrypt.compareSync(password, user.password)) {
      auditLog(db, null, username, null, 'login', 'auth', 'user', null, '登录失败：用户名或密码错误', 'failure');
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
  }

  if (user.status !== 'active') {
    auditLog(db, user.id, username, user.real_name, 'login', 'auth', 'user', String(user.id), '登录失败：账号已禁用', 'failure');
    return res.status(403).json({ success: false, message: '账号已被禁用，请联系管理员' });
  }

  const token = generateToken(user);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?,?,?)').run(user.id, token, expiresAt);
  db.prepare("DELETE FROM sessions WHERE user_id=? AND token!=?").run(user.id, token);
  db.prepare('UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?').run(user.id);

  auditLog(db, user.id, username, user.real_name, 'login', 'auth', 'user', String(user.id), '登录成功');

  const permissions = db.prepare('SELECT permission_code FROM role_permissions WHERE role=?').all(user.role).map(p => p.permission_code);

  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, real_name: user.real_name, role: user.role, department: user.department, permissions }
  });
});

router.post('/api/logout', requirePermission(), (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
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

module.exports = router;
