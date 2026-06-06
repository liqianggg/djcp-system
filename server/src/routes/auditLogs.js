const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { requirePermission } = require('../middleware/auth');

router.get('/api/audit-logs', requirePermission('audit:view'), (req, res) => {
  const db = getDb();
  const { page, page_size, action, module, start_date, end_date } = req.query;
  const pageNum = parseInt(page) || 1;
  const pageSize = parseInt(page_size) || 50;
  let where = 'WHERE 1=1';
  const params = [];
  if (action) { where += ' AND action=?'; params.push(action); }
  if (module) { where += ' AND module=?'; params.push(module); }
  if (start_date) { where += ' AND date(created_at)>=?'; params.push(start_date); }
  if (end_date) { where += ' AND date(created_at)<=?'; params.push(end_date); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM audit_logs ${where}`).get(...params).cnt;
  const offset = (pageNum - 1) * pageSize;
  const data = db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);

  res.json({ data, total, page: pageNum, pageSize });
});

router.get('/api/audit-logs/export', requirePermission('audit:export'), (req, res) => {
  const db = getDb();
  const { action, module, start_date, end_date } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (action) { where += ' AND action=?'; params.push(action); }
  if (module) { where += ' AND module=?'; params.push(module); }
  if (start_date) { where += ' AND date(created_at)>=?'; params.push(start_date); }
  if (end_date) { where += ' AND date(created_at)<=?'; params.push(end_date); }

  const logs = db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC`).all(...params);

  const BOM = '﻿';
  const headers = ['时间', '操作人', '用户名', '操作', '模块', '目标类型', '目标ID', '详情', '结果'];
  const csv = BOM + headers.join(',') + '\n' + logs.map(l => [
    l.created_at, l.real_name, l.username, l.action, l.module,
    l.target_type, l.target_id, (l.detail || '').replace(/,/g, '，'), l.result
  ].join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
  res.send(csv);
});

module.exports = router;
