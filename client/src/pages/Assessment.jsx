import React, { useState, useEffect } from 'react';
import { Plus, Eye, Download } from 'lucide-react';

import { apiGet, apiPost, apiPut, apiDelete, apiUpload, hasPermission, fetchBlobUrl } from '../api';

const TYPE_LABELS = { initial: '初次测评', reassessment: '复评', annual: '年度测评' };
const CONC_LABELS = { pass: '通过', conditional_pass: '有条件通过', fail: '未通过' };
const CONC_COLORS = { pass: 'badge-green', conditional_pass: 'badge-yellow', fail: 'badge-red' };

// 测评大类和控制点
const ASSESSMENT_TEMPLATE = [
  { category: '物理安全', items: [
    { id: 'PS-01', desc: '物理位置选择', max: 5 },
    { id: 'PS-02', desc: '物理访问控制', max: 5 },
    { id: 'PS-03', desc: '防盗窃和防破坏', max: 5 },
    { id: 'PS-04', desc: '防雷击', max: 5 },
    { id: 'PS-05', desc: '防火', max: 5 },
    { id: 'PS-06', desc: '防水和防潮', max: 5 },
    { id: 'PS-07', desc: '防静电', max: 5 },
    { id: 'PS-08', desc: '温湿度控制', max: 5 },
    { id: 'PS-09', desc: '电力供应', max: 5 },
    { id: 'PS-10', desc: '电磁防护', max: 5 },
  ]},
  { category: '网络安全', items: [
    { id: 'NS-01', desc: '结构安全', max: 5 },
    { id: 'NS-02', desc: '访问控制', max: 5 },
    { id: 'NS-03', desc: '安全审计', max: 5 },
    { id: 'NS-04', desc: '边界完整性检查', max: 5 },
    { id: 'NS-05', desc: '入侵防范', max: 5 },
    { id: 'NS-06', desc: '恶意代码防范', max: 5 },
    { id: 'NS-07', desc: '网络设备防护', max: 5 },
  ]},
  { category: '主机安全', items: [
    { id: 'HS-01', desc: '身份鉴别', max: 5 },
    { id: 'HS-02', desc: '访问控制', max: 5 },
    { id: 'HS-03', desc: '安全审计', max: 5 },
    { id: 'HS-04', desc: '剩余信息保护', max: 5 },
    { id: 'HS-05', desc: '入侵防范', max: 5 },
    { id: 'HS-06', desc: '恶意代码防范', max: 5 },
    { id: 'HS-07', desc: '资源控制', max: 5 },
  ]},
  { category: '应用安全', items: [
    { id: 'AS-01', desc: '身份鉴别', max: 5 },
    { id: 'AS-02', desc: '访问控制', max: 5 },
    { id: 'AS-03', desc: '安全审计', max: 5 },
    { id: 'AS-04', desc: '剩余信息保护', max: 5 },
    { id: 'AS-05', desc: '通信完整性', max: 5 },
    { id: 'AS-06', desc: '通信保密性', max: 5 },
    { id: 'AS-07', desc: '抗抵赖', max: 5 },
    { id: 'AS-08', desc: '软件容错', max: 5 },
    { id: 'AS-09', desc: '资源控制', max: 5 },
  ]},
  { category: '数据安全', items: [
    { id: 'DS-01', desc: '数据完整性', max: 5 },
    { id: 'DS-02', desc: '数据保密性', max: 5 },
    { id: 'DS-03', desc: '备份和恢复', max: 5 },
  ]},
  { category: '管理制度', items: [
    { id: 'MP-01', desc: '管理制度', max: 5 },
    { id: 'MP-02', desc: '制定和发布', max: 5 },
    { id: 'MP-03', desc: '评审和修订', max: 5 },
  ]},
  { category: '管理机构', items: [
    { id: 'MO-01', desc: '岗位设置', max: 5 },
    { id: 'MO-02', desc: '人员配备', max: 5 },
    { id: 'MO-03', desc: '授权和审批', max: 5 },
    { id: 'MO-04', desc: '沟通和合作', max: 5 },
  ]},
  { category: '人员安全', items: [
    { id: 'PSM-01', desc: '人员录用', max: 5 },
    { id: 'PSM-02', desc: '人员离岗', max: 5 },
    { id: 'PSM-03', desc: '安全意识教育和培训', max: 5 },
    { id: 'PSM-04', desc: '外部人员访问管理', max: 5 },
  ]},
  { category: '系统建设', items: [
    { id: 'SC-01', desc: '系统定级', max: 5 },
    { id: 'SC-02', desc: '安全方案设计', max: 5 },
    { id: 'SC-03', desc: '产品采购和使用', max: 5 },
    { id: 'SC-04', desc: '自行软件开发', max: 5 },
    { id: 'SC-05', desc: '外包软件开发', max: 5 },
    { id: 'SC-06', desc: '工程实施', max: 5 },
    { id: 'SC-07', desc: '测试验收', max: 5 },
    { id: 'SC-08', desc: '系统交付', max: 5 },
  ]},
  { category: '系统运维', items: [
    { id: 'SO-01', desc: '环境管理', max: 5 },
    { id: 'SO-02', desc: '资产管理', max: 5 },
    { id: 'SO-03', desc: '介质管理', max: 5 },
    { id: 'SO-04', desc: '设备管理', max: 5 },
    { id: 'SO-05', desc: '监控管理', max: 5 },
    { id: 'SO-06', desc: '安全管理中心', max: 5 },
    { id: 'SO-07', desc: '网络安全管理', max: 5 },
    { id: 'SO-08', desc: '系统安全管理', max: 5 },
    { id: 'SO-09', desc: '恶意代码防范管理', max: 5 },
    { id: 'SO-10', desc: '密码管理', max: 5 },
    { id: 'SO-11', desc: '变更管理', max: 5 },
    { id: 'SO-12', desc: '备份与恢复管理', max: 5 },
    { id: 'SO-13', desc: '安全事件处置', max: 5 },
    { id: 'SO-14', desc: '应急预案管理', max: 5 },
  ]},
];

export default function Assessment() {
  const [systems, setSystems] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [viewAssessment, setViewAssessment] = useState(null);
  const [form, setForm] = useState({
    system_id: '', assessment_agency: '', assessment_type: 'initial',
    assessment_date: new Date().toISOString().split('T')[0],
    overall_score: 0, overall_level: '', conclusion: 'pass',
    report_number: '', assessment_report: '', status: 'planned', items: []
  });

  const loadAssessments = () => {
    apiGet('/api/assessments').then(setAssessments);
  };

  useEffect(() => {
    apiGet('/api/systems').then(setSystems);
    apiGet('/api/agencies').then(setAgencies);
    loadAssessments();
  }, []);

  const initItems = () => {
    const items = [];
    ASSESSMENT_TEMPLATE.forEach(cat => {
      cat.items.forEach(item => {
        items.push({
          category: cat.category,
          control_id: item.id,
          control_desc: item.desc,
          score: 0,
          max_score: item.max,
          result: '不符合',
          remarks: ''
        });
      });
    });
    setForm({ ...form, items });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = {
      ...form,
      overall_score: form.items.reduce((s, i) => s + (i.score || 0), 0),
      overall_level: getLevel(form.items.reduce((s, i) => s + (i.score || 0), 0))
    };
    await apiPost('/api/assessments', body);
    setShowModal(false);
    setForm({ system_id: '', assessment_agency: '', assessment_type: 'initial', assessment_date: new Date().toISOString().split('T')[0], overall_score: 0, overall_level: '', conclusion: 'pass', report_number: '', assessment_report: '', status: 'planned', items: [] });
    loadAssessments();
  };

  const getLevel = (score) => {
    const maxTotal = form.items.reduce((s, i) => s + (i.max_score || 5), 0);
    const rate = maxTotal > 0 ? score / maxTotal : 0;
    if (rate >= 0.9) return '优';
    if (rate >= 0.8) return '良';
    if (rate >= 0.7) return '中';
    if (rate >= 0.6) return '差';
    return '不合格';
  };

  const handleView = async (id) => {
    const res = await fetch('/api/assessments?' + new URLSearchParams({}), { headers: { 'Authorization': `Bearer ${localStorage.getItem('djcp_token')}` } });
    const all = await res.json();
    const found = all.find(a => a.id === id);
    if (found) setViewAssessment(found);
  };

  if (viewAssessment) {
    return <AssessmentDetail assessment={viewAssessment} onBack={() => setViewAssessment(null)} />;
  }

  return (
    <div>
      <div className="page-header">
        <h2>✅ 测评管理</h2>
        <button className="btn btn-primary" onClick={() => { initItems(); setShowModal(true); }}>
          <Plus size={16} /> 新建测评
        </button>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>信息系统</th><th>测评机构</th><th>测评类型</th><th>测评日期</th><th>综合得分</th><th>等保级别</th><th>结论</th><th>状态</th><th>操作</th></tr>
              </thead>
              <tbody>
                {assessments.length === 0 ? (
                  <tr><td colSpan="9" className="empty-state"><h3>暂无测评记录</h3><p>点击"新建测评"创建测评记录</p></td></tr>
                ) : assessments.map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.system_name}</strong></td>
                    <td>{a.assessment_agency || '-'}</td>
                    <td>{TYPE_LABELS[a.assessment_type] || a.assessment_type}</td>
                    <td>{a.assessment_date || '-'}</td>
                    <td><strong>{a.overall_score}</strong></td>
                    <td><span className="badge badge-blue">{a.overall_level || '-'}</span></td>
                    <td><span className={`badge ${CONC_COLORS[a.conclusion]}`}>{CONC_LABELS[a.conclusion]}</span></td>
                    <td><span className="badge badge-blue">{a.status === 'completed' ? '已完成' : a.status === 'in_progress' ? '进行中' : '计划中'}</span></td>
                    <td><div className="toolbar">
                      <button className="btn btn-sm" onClick={() => handleView(a.id)}><Eye size={14} /> 查看</button>
                      <button className="btn btn-sm" onClick={async () => {
                        const u = await fetchBlobUrl('/api/assessments/'+a.id+'/report');
                        const aEl = document.createElement('a');
                        aEl.href = u; aEl.download = '测评报告-'+a.system_name+'.pdf';
                        document.body.appendChild(aEl); aEl.click();
                        document.body.removeChild(aEl);
                      }} title="导出PDF"><Download size={13} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '900px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              新建测评
              <button className="btn btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>信息系统 *</label>
                    <select className="form-control" required value={form.system_id} onChange={e => setForm({...form, system_id: e.target.value})}>
                      <option value="">请选择</option>
                      {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>测评机构</label>
                    <select className="form-control" value={form.assessment_agency} onChange={e => setForm({...form, assessment_agency: e.target.value})}>
                      <option value="">请选择测评机构</option>
                      {agencies.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row-3">
                  <div className="form-group">
                    <label>测评类型</label>
                    <select className="form-control" value={form.assessment_type} onChange={e => setForm({...form, assessment_type: e.target.value})}>
                      {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>测评日期</label>
                    <input className="form-control" type="date" value={form.assessment_date} onChange={e => setForm({...form, assessment_date: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>状态</label>
                    <select className="form-control" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                      <option value="planned">计划中</option>
                      <option value="in_progress">进行中</option>
                      <option value="completed">已完成</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>结论</label>
                    <select className="form-control" value={form.conclusion} onChange={e => setForm({...form, conclusion: e.target.value})}>
                      {Object.entries(CONC_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>报告编号</label>
                    <input className="form-control" value={form.report_number} onChange={e => setForm({...form, report_number: e.target.value})} />
                  </div>
                </div>

                {form.items.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <h4 style={{ marginBottom: '12px' }}>测评项评分（0-5分）</h4>
                    {(() => {
                      const cats = {};
                      form.items.forEach((item, idx) => {
                        if (!cats[item.category]) cats[item.category] = [];
                        cats[item.category].push({ ...item, idx });
                      });
                      return Object.entries(cats).map(([cat, items]) => {
                        const totalScore = items.reduce((s, i) => s + i.score, 0);
                        const maxScore = items.reduce((s, i) => s + i.max_score, 0);
                        return (
                          <details key={cat} style={{ marginBottom: '8px' }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                              {cat} - 得分: {totalScore}/{maxScore}
                            </summary>
                            <div style={{ padding: '8px' }}>
                              {items.map(({ control_id, control_desc, score, max_score, result, idx }) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                                  <code style={{ width: '70px' }}>{control_id}</code>
                                  <span style={{ flex: 1, fontSize: '13px' }}>{control_desc}</span>
                                  <input type="number" min="0" max={max_score} style={{ width: '50px' }} className="form-control"
                                    value={score} onChange={e => {
                                      const items = [...form.items];
                                      items[idx] = { ...items[idx], score: parseInt(e.target.value) || 0 };
                                      setForm({ ...form, items });
                                    }} />
                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>/{max_score}</span>
                                  <select className="form-control" style={{ width: '100px' }} value={result}
                                    onChange={e => {
                                      const items = [...form.items];
                                      items[idx] = { ...items[idx], result: e.target.value };
                                      setForm({ ...form, items });
                                    }}>
                                    <option value="符合">符合</option>
                                    <option value="部分符合">部分符合</option>
                                    <option value="不符合">不符合</option>
                                    <option value="不适用">不适用</option>
                                  </select>
                                </div>
                              ))}
                            </div>
                          </details>
                        );
                      });
                    })()}
                    <div style={{ marginTop: '12px', fontSize: '14px', fontWeight: 600 }}>
                      总分: {form.items.reduce((s, i) => s + (i.score || 0), 0)}
                      &nbsp;|&nbsp;
                      满分: {form.items.reduce((s, i) => s + (i.max_score || 5), 0)}
                      &nbsp;|&nbsp;
                      得分率: {(form.items.reduce((s, i) => s + (i.score || 0), 0) / form.items.reduce((s, i) => s + (i.max_score || 5), 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label>测评报告摘要</label>
                  <textarea className="form-control" value={form.assessment_report} onChange={e => setForm({...form, assessment_report: e.target.value})} rows={3}></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">保存测评</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AssessmentDetail({ assessment, onBack }) {
  const cats = {};
  (assessment.items || []).forEach(i => {
    if (!cats[i.category]) cats[i.category] = [];
    cats[i.category].push(i);
  });

  const totalScore = (assessment.items || []).reduce((s, i) => s + i.score, 0);
  const maxScore = (assessment.items || []).reduce((s, i) => s + i.max_score, 0);

  return (
    <div>
      <div className="page-header">
        <h2>📊 测评详情 - {assessment.system_name}</h2>
        <button className="btn" onClick={onBack}>← 返回</button>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card"><div><div className="stat-value">{totalScore}</div><div className="stat-label">总得分</div></div></div>
          <div className="stat-card"><div><div className="stat-value">{assessment.overall_level}</div><div className="stat-label">等保级别</div></div></div>
          <div className="stat-card"><div><div className="stat-value">{(totalScore/maxScore*100).toFixed(1)}%</div><div className="stat-label">得分率</div></div></div>
          <div className="stat-card"><div><div className="stat-value"><span className={`badge ${CONC_COLORS[assessment.conclusion]}`}>{CONC_LABELS[assessment.conclusion]}</span></div><div className="stat-label">结论</div></div></div>
        </div>

        {Object.entries(cats).map(([cat, items]) => (
          <div key={cat} className="card">
            <div className="card-header">{cat} ({items.reduce((s,i) => s + i.score, 0)}/{items.reduce((s,i) => s + i.max_score, 0)})</div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>编号</th><th>描述</th><th>得分</th><th>满分</th><th>结果</th></tr></thead>
                <tbody>
                  {items.map(i => (
                    <tr key={i.id}>
                      <td><code>{i.control_id}</code></td>
                      <td>{i.control_desc}</td>
                      <td><strong>{i.score}</strong></td>
                      <td>{i.max_score}</td>
                      <td><span className={`badge ${i.result === '符合' ? 'badge-green' : i.result === '部分符合' ? 'badge-yellow' : 'badge-red'}`}>{i.result}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
