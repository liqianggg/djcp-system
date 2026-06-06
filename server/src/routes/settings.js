const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { requirePermission } = require('../middleware/auth');
const { ldapTestConnection } = require('../services/ldap');

router.get('/api/settings', requirePermission('settings:view'), (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM settings').all();
  const result = {};
  rows.forEach(r => { result[r.key] = r.value; });
  res.json(result);
});

router.put('/api/settings', requirePermission('settings:view'), (req, res) => {
  const db = getDb();
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?,?,CURRENT_TIMESTAMP)').run(key, String(value));
  }
  res.json({ success: true });
});

router.post('/api/settings/ldap/test', requirePermission('settings:view'), async (req, res) => {
  try {
    const result = await ldapTestConnection(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
