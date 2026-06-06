const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { requirePermission, auditLog } = require('../middleware/auth');

router.get('/api/systems', requirePermission('system:view'), (req, res) => {
  const db = getDb();
  const { status, search, page, page_size } = req.query;
  const usePagination = page && page_size;
  const pageNum = parseInt(page) || 1;
  const pageSize = parseInt(page_size) || 0;

  let where = 'WHERE 1=1';
  const params = [];
  if (status) { where += ' AND s.status=?'; params.push(status); }
  if (search) { where += ' AND (s.name LIKE ? OR s.code LIKE ? OR s.department LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  let sql = `SELECT s.*,
    (SELECT COUNT(*) FROM rectifications WHERE system_id=s.id AND status IN ('pending','in_progress')) as pendingRectifications,
    (SELECT json_object('business_impact_level', business_impact_level, 'service_scope', service_scope, 'business_dependency', business_dependency, 'classified_by', classified_by, 'classified_at', classified_at) FROM classifications WHERE system_id=s.id LIMIT 1) as classification,
    (SELECT json_object('filing_number', filing_number, 'filing_authority', filing_authority, 'filing_date', filing_date, 'filing_status', filing_status, 'approval_date', approval_date) FROM filings WHERE system_id=s.id LIMIT 1) as filing
    FROM systems s ${where} ORDER BY s.updated_at DESC`;
  const total = usePagination ? db.prepare(`SELECT COUNT(*) as cnt FROM systems s ${where}`).get(...params.map(p => p)) : null;

  if (usePagination) { sql += ' LIMIT ? OFFSET ?'; params.push(pageSize, (pageNum - 1) * pageSize); }
  const rows = db.prepare(sql).all(...params);
  const data = rows.map(r => ({ ...r, classification: safeJson(r.classification), filing: safeJson(r.filing) }));

  if (usePagination) {
    res.json({ data, total: total.cnt, page: pageNum, pageSize });
  } else {
    res.json(data);
  }
});

router.get('/api/systems/:id', requirePermission('system:view'), (req, res) => {
  const db = getDb();
  const s = db.prepare('SELECT * FROM systems WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: '系统不存在' });
  const classification = db.prepare('SELECT * FROM classifications WHERE system_id=? ORDER BY classified_at DESC LIMIT 1').get(s.id);
  const filing = db.prepare('SELECT * FROM filings WHERE system_id=? ORDER BY created_at DESC LIMIT 1').get(s.id);
  const gapAnalyses = db.prepare('SELECT * FROM gap_analyses WHERE system_id=? ORDER BY created_at DESC').all(s.id);
  const rectifications = db.prepare('SELECT * FROM rectifications WHERE system_id=? ORDER BY created_at DESC').all(s.id);
  const assessments = db.prepare('SELECT a.*, ag.name as agency_name FROM assessments a LEFT JOIN assessment_agencies ag ON a.agency_id=ag.id WHERE a.system_id=? ORDER BY a.created_at DESC').all(s.id);
  res.json({ ...s, classification, filing, gapAnalyses, rectifications, assessments });
});

router.post('/api/systems', requirePermission('system:create'), (req, res) => {
  const db = getDb();
  const { name, code, department, category, description, security_level, status } = req.body;
  const result = db.prepare('INSERT INTO systems (name, code, department, category, description, security_level, status) VALUES (?,?,?,?,?,?,?)')
    .run(name, code, department || '', category || 'S2', description || null, security_level || 1, status || 'draft');
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'create', 'system', 'system', String(result.lastInsertRowid), `创建信息系统: ${name}`);
  res.json({ success: true, id: result.lastInsertRowid });
});

router.put('/api/systems/:id', requirePermission('system:edit'), (req, res) => {
  const db = getDb();
  const { name, code, department, category, description, security_level, status } = req.body;
  db.prepare('UPDATE systems SET name=?, code=?, department=?, category=?, description=?, security_level=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(name, code, department || '', category, description || null, security_level, status, req.params.id);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'update', 'system', 'system', req.params.id, `编辑信息系统: ${name}`);
  res.json({ success: true });
});

router.delete('/api/systems/:id', requirePermission('system:delete'), (req, res) => {
  const db = getDb();
  const s = db.prepare('SELECT name FROM systems WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: '系统不存在' });
  db.prepare('DELETE FROM systems WHERE id=?').run(req.params.id);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'delete', 'system', 'system', req.params.id, `删除信息系统: ${s.name}`);
  res.json({ success: true });
});

function safeJson(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch (_) { return null; }
}

// Batch delete
router.delete('/api/systems/batch', requirePermission('system:delete'), (req, res) => {
  const db = getDb();
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '请选择要删除的系统' });
  const placeholders = ids.map(() => '?').join(',');
  const deleted = db.prepare(`DELETE FROM systems WHERE id IN (${placeholders})`).run(...ids);
  if (deleted.changes > 0) {
    auditLog(db, req.user.id, req.user.username, req.user.real_name, 'delete', 'system', 'system', ids.join(','), `批量删除 ${deleted.changes} 个信息系统`);
  }
  res.json({ success: true, deleted: deleted.changes });
});

module.exports = router;
