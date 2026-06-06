const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { requirePermission } = require('../middleware/auth');

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

module.exports = router;
