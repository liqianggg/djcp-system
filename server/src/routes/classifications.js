const express = require('express');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const router = express.Router();
const { getDb } = require('../database');
const { requirePermission, auditLog, verifyToken, JWT_SECRET } = require('../middleware/auth');

const FONT_PATH = '/Library/Fonts/Arial Unicode.ttf';

function generateClassificationPDF(cls) {
  return new Promise((resolve, reject) => {
    const levelLabels = { 1: '自主保护级', 2: '指导保护级', 3: '监督保护级', 4: '强制保护级', 5: '专控保护级' };
    const catLabels = { S1:'业务信息安全-一般', S2:'业务信息安全-严重', S3:'业务信息安全-特别严重', G1:'系统服务安全-一般', G2:'系统服务安全-严重', G3:'系统服务安全-特别严重' };
    const reportDate = new Date().toISOString().slice(0,10);

    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('CJK', FONT_PATH);
    doc.font('CJK');

    doc.fontSize(20).fillColor('#1a56db').text('网络安全等级保护定级报告', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#666')
      .text('报告编号: DJCP-DJ-' + String(cls.id).padStart(4,'0') + '  |  生成日期: ' + reportDate, { align: 'center' });
    doc.moveDown(0.8);

    const drawLine = () => { doc.moveDown(0.3).strokeColor('#d1d5db').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.8); };
    const sectionTitle = (text) => { doc.moveDown(0.5).fontSize(15).fillColor('#1a56db').text(text).moveDown(0.3); };
    const row = (label, value, labelW) => {
      labelW = labelW || 130;
      const y = doc.y;
      doc.fontSize(11).fillColor('#333');
      doc.text(label, 50, y, { width: labelW });
      doc.fillColor('#000').text(value || '-', 50 + labelW, y, { width: 495 - labelW });
    };

    drawLine();
    sectionTitle('一、信息系统基本信息');
    doc.fontSize(11).fillColor('#333');
    row('系统名称', cls.system_name); doc.moveDown(0.2);
    row('系统编号', cls.system_code); doc.moveDown(0.2);
    row('所属部门', cls.department); doc.moveDown(0.2);
    row('系统类别', catLabels[cls.category] || cls.category); doc.moveDown(0.2);
    row('安全保护等级', '第' + (cls.security_level || '-') + '级 ' + (levelLabels[cls.security_level] || '')); doc.moveDown(0.2);
    row('系统描述', cls.system_desc); doc.moveDown(0.5);

    drawLine();
    sectionTitle('二、定级结果');
    row('业务信息安全等级', '第' + cls.business_impact_level + '级 ' + levelLabels[cls.business_impact_level]); doc.moveDown(0.2);
    row('服务范围', cls.service_scope); doc.moveDown(0.2);
    row('业务依赖描述', cls.business_dependency); doc.moveDown(0.2);
    row('定级人', cls.classified_by); doc.moveDown(0.2);
    row('定级日期', cls.classified_at); doc.moveDown(0.5);

    drawLine();
    sectionTitle('三、定级依据');
    doc.fontSize(11).fillColor('#000')
      .text('根据《信息安全技术 网络安全等级保护定级指南》（GB/T 22240-2020），结合信息系统在国家安全、经济建设、社会生活中的重要程度，以及系统遭到破坏后对国家安全、社会秩序、公共利益以及公民、法人和其他组织合法权益的危害程度等因素，确定信息系统的安全保护等级。', { align: 'justify' });
    doc.moveDown(0.5);

    drawLine();
    sectionTitle('四、等级保护定级矩阵');
    const matrixData = [
      ['', 'G1 一般损害', 'G2 严重损害', 'G3 特别严重损害'],
      ['S1 一般损害', '第一级', '第二级', '第三级'],
      ['S2 严重损害', '第二级', '第三级', '第四级'],
      ['S3 特别严重损害', '第三级', '第四级', '第五级']
    ];
    const colW = [130, 120, 120, 120];
    const rowH = 28;
    const startX = 50;
    let tableY = doc.y;
    const levels = [null, 1, 2, 3, 2, 3, 4, 3, 4, 5];

    matrixData.forEach((r, ri) => {
      let x = startX;
      r.forEach((cell, ci) => {
        const isMatch = ri > 0 && ci > 0 && levels[(ri-1)*3 + ci] === cls.business_impact_level;
        if (isMatch) doc.rect(x, tableY, colW[ci], rowH).fill('#fef2f2');
        if (ri === 0) {
          doc.rect(x, tableY, colW[ci], rowH).fillAndStroke('#1e3a5f', '#1e3a5f');
          doc.fillColor('#fff');
        } else {
          doc.rect(x, tableY, colW[ci], rowH).stroke('#d1d5db');
          doc.fillColor(isMatch ? '#dc2626' : '#000');
        }
        doc.fontSize(10).text(cell, x + 4, tableY + 7, { width: colW[ci] - 8, align: 'center' });
        x += colW[ci];
      });
      tableY += rowH;
    });
    doc.y = tableY + 12;
    doc.fontSize(12).fillColor('#dc2626')
      .text('▲ 当前定级结果：第' + cls.business_impact_level + '级 - ' + levelLabels[cls.business_impact_level], { align: 'center' });
    doc.moveDown(0.8);

    drawLine();
    sectionTitle('五、定级说明');
    doc.fontSize(11).fillColor('#000')
      .text(cls.classification_report || '（详见定级报告正文）', { align: 'justify' });
    doc.moveDown(1.5);

    doc.strokeColor('#d1d5db').lineWidth(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#999')
      .text('报告生成时间: ' + new Date().toLocaleString('zh-CN'), { align: 'right' });
    doc.text('本报告由等保测评全生命周期管理系统自动生成', { align: 'right' });

    doc.end();
  });
}

router.get('/api/classifications', requirePermission('classification:view'), (req, res) => {
  const db = getDb();
  const { system_id } = req.query;
  let sql = 'SELECT c.*, s.name as system_name, u.real_name as classified_by_name FROM classifications c JOIN systems s ON c.system_id = s.id LEFT JOIN users u ON c.classified_by_id = u.id';
  const params = [];
  if (system_id) { sql += ' WHERE c.system_id=?'; params.push(system_id); }
  sql += ' ORDER BY c.classified_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/api/classifications', requirePermission('classification:create'), (req, res) => {
  const db = getDb();
  const { system_id, business_impact_level, service_scope, business_dependency, classification_report, classified_by, classified_by_id } = req.body;
  const result = db.prepare('INSERT INTO classifications (system_id, business_impact_level, service_scope, business_dependency, classification_report, classified_by, classified_by_id) VALUES (?,?,?,?,?,?,?)')
    .run(system_id, business_impact_level, service_scope, business_dependency, classification_report, classified_by || '', classified_by_id || null);
  db.prepare("UPDATE systems SET status='classified', security_level=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(business_impact_level, system_id);
  auditLog(db, req.user.id, req.user.username, req.user.real_name, 'create', 'classification', 'system', String(system_id), `系统定级: L${business_impact_level}`);
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.get('/api/classifications/:id/report', (req, res) => {
  const userInfo = verifyToken(req);
  if (!userInfo) return res.status(401).json({ error: '未提供认证令牌' });

  const db = getDb();
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

  const format = req.query.format || 'html';
  const filename = `定级报告-${cls.system_name}-${new Date().toISOString().slice(0,10)}`;

  if (format === 'pdf') {
    generateClassificationPDF(cls).then(pdfBuffer => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename + '.pdf')}`);
      res.send(pdfBuffer);
    }).catch(err => {
      console.error('PDF generation error:', err);
      res.status(500).json({ error: 'PDF 生成失败' });
    });
  } else {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
});

module.exports = router;
