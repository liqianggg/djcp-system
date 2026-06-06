const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { requirePermission } = require('../middleware/auth');

router.get('/api/permissions', requirePermission('permission:view'), (req, res) => {
  const db = getDb();
  const permissions = db.prepare('SELECT * FROM permissions ORDER BY module, code').all();
  const rolePermissions = db.prepare('SELECT * FROM role_permissions').all();
  const roles = ['system_admin', 'security_admin', 'security_auditor', 'operator', 'viewer'];
  const rolePermMap = {};
  roles.forEach(r => { rolePermMap[r] = rolePermissions.filter(rp => rp.role === r).map(rp => rp.permission_code); });
  res.json({ permissions, rolePermissions: rolePermMap });
});

router.put('/api/permissions', requirePermission('permission:manage'), (req, res) => {
  const db = getDb();
  const { role, permissions } = req.body;
  if (!role || !permissions) return res.status(400).json({ error: '缺少参数' });
  db.prepare('DELETE FROM role_permissions WHERE role=?').run(role);
  const stmt = db.prepare('INSERT INTO role_permissions (role, permission_code) VALUES (?,?)');
  for (const code of permissions) stmt.run(role, code);
  res.json({ success: true });
});

module.exports = router;
