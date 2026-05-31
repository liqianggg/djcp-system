import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown, ChevronRight, Eye, Upload, FileSpreadsheet } from 'lucide-react';

import { apiGet, apiPost, apiPut, apiDelete, apiUpload, hasPermission } from '../api';

// 等保2.0三级要求项模板
const DEFAULT_REQUIREMENTS = [
  { category: '物理安全', items: [
    { id: 'PS-01', desc: '物理位置选择', expected: '机房场地应避免设在建筑物的顶层或地下室' },
    { id: 'PS-02', desc: '物理访问控制', expected: '机房出入口应配置电子门禁系统' },
    { id: 'PS-03', desc: '防盗窃和防破坏', expected: '设备或主要部件应设置固定标记' },
    { id: 'PS-04', desc: '防雷击', expected: '应设置防雷保安器' },
    { id: 'PS-05', desc: '防火', expected: '应设置自动消防系统' },
    { id: 'PS-06', desc: '防水和防潮', expected: '应采取措施防止雨水通过机房窗户渗入' },
  ]},
  { category: '网络安全', items: [
    { id: 'NS-01', desc: '网络架构', expected: '应保证网络设备的业务处理能力具备冗余空间' },
    { id: 'NS-02', desc: '访问控制', expected: '应在网络边界部署访问控制设备' },
    { id: 'NS-03', desc: '安全审计', expected: '应对网络系统中的网络设备运行状况进行审计' },
    { id: 'NS-04', desc: '边界防护', expected: '应能够对非授权设备私自联到内部网络的行为进行限制' },
    { id: 'NS-05', desc: '入侵防范', expected: '应在网络边界处监视攻击行为' },
  ]},
  { category: '主机安全', items: [
    { id: 'HS-01', desc: '身份鉴别', expected: '应对登录操作系统和数据库系统的用户进行身份标识和鉴别' },
    { id: 'HS-02', desc: '访问控制', expected: '应启用访问控制功能，依据安全策略控制用户对资源的访问' },
    { id: 'HS-03', desc: '安全审计', expected: '审计范围应覆盖到服务器上的每个操作系统用户和数据库用户' },
    { id: 'HS-04', desc: '入侵防范', expected: '操作系统应遵循最小安装的原则，仅安装需要的组件' },
    { id: 'HS-05', desc: '恶意代码防范', expected: '应安装防恶意代码软件，并及时更新' },
  ]},
  { category: '应用安全', items: [
    { id: 'AS-01', desc: '身份鉴别', expected: '应提供专用的登录控制模块对登录用户进行身份标识和鉴别' },
    { id: 'AS-02', desc: '访问控制', expected: '应提供访问控制功能，对用户分配不同的权限' },
    { id: 'AS-03', desc: '安全审计', expected: '应提供覆盖到每个用户的安全审计功能' },
    { id: 'AS-04', desc: '通信完整性', expected: '应采用密码技术保证通信过程中数据的完整性' },
  ]},
  { category: '数据安全', items: [
    { id: 'DS-01', desc: '数据完整性', expected: '应能够检测到系统管理数据、鉴别信息和重要业务数据在传输过程中完整性受到破坏' },
    { id: 'DS-02', desc: '数据保密性', expected: '应采用加密或其他有效措施实现系统管理数据、鉴别信息和重要业务数据传输保密性' },
    { id: 'DS-03', desc: '备份和恢复', expected: '应提供异地数据备份功能' },
  ]},
  { category: '安全管理', items: [
    { id: 'SM-01', desc: '管理制度', expected: '应制定网络安全工作的总体方针和安全策略' },
    { id: 'SM-02', desc: '安全管理机构', expected: '应设立系统管理员、网络管理员、安全管理员等岗位' },
    { id: 'SM-03', desc: '人员安全管理', expected: '应指定或授权专门的部门或人员负责人员录用' },
    { id: 'SM-04', desc: '系统建设管理', expected: '应制定安全方案设计，形成配套文件' },
    { id: 'SM-05', desc: '系统运维管理', expected: '应指定专门的部门或人员定期对监测和报警记录进行分析、评审' },
  ]},
];

const RISK_COLORS = { high: 'badge-red', medium: 'badge-yellow', low: 'badge-green' };
const RISK_LABELS = { high: '高', medium: '中', low: '低' };
const STATUS_LABELS = { draft: '草稿', in_progress: '进行中', completed: '已完成' };

export default function GapAnalysis() {
  const [systems, setSystems] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [viewAnalysis, setViewAnalysis] = useState(null);
  const [expandedCats, setExpandedCats] = useState({});
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({
    system_id: '', analysis_date: new Date().toISOString().split('T')[0],
    overall_score: 0, compliance_rate: 0, status: 'draft', items: []
  });

  const loadAnalyses = () => {
    apiGet('/api/gap-analyses').then(setAnalyses);
  };

  useEffect(() => {
    apiGet('/api/systems').then(setSystems);
    loadAnalyses();
  }, []);

  const handleFileImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/gap-analyses/import", {
        method: "POST",
        headers: { Authorization: "Bearer " + localStorage.getItem("djcp_token") },
        body: fd
      });
      const data = await res.json();
      if (data.success) {
        setImportPreview(data.items);
        setForm(prev => ({ ...prev, items: data.items }));
        setShowModal(true);
        setViewAnalysis(null);
      } else {
        alert("导入失败: " + (data.error || "未知错误"));
      }
    } catch(err) {
      alert("导入失败: " + err.message);
    }
    setImporting(false);
    e.target.value = "";
  };

  const initItems = () => {
    const items = [];
    DEFAULT_REQUIREMENTS.forEach(cat => {
      cat.items.forEach(item => {
        items.push({
          requirement_category: cat.category,
          requirement_id: item.id,
          requirement_desc: item.desc,
          expected_value: item.expected,
          actual_value: '',
          is_compliant: false,
          risk_level: 'medium',
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
      overall_score: form.items.filter(i => i.is_compliant).length,
      compliance_rate: form.items.length > 0 ? Math.round((form.items.filter(i => i.is_compliant).length / form.items.length) * 100) : 0
    };
    await apiPost('/api/gap-analyses', body);
    setShowModal(false);
    setForm({ system_id: '', analysis_date: new Date().toISOString().split('T')[0], overall_score: 0, compliance_rate: 0, status: 'draft', items: [] });
    loadAnalyses();
  };

  const updateItem = (idx, field, value) => {
    const newItems = [...form.items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setForm({ ...form, items: newItems });
  };

  const compliantCount = form.items.filter(i => i.is_compliant).length;
  const totalCount = form.items.length;

  const handleView = async (id) => {
    const res = await fetch('/api/gap-analyses/' + id, { headers: { 'Authorization': `Bearer ${localStorage.getItem('djcp_token')}` } });
    const data = await res.json();
    setViewAnalysis(data);
  };

  if (viewAnalysis) {
    return <AnalysisDetail analysis={viewAnalysis} onBack={() => setViewAnalysis(null)} />;
  }

  // Group by category for stats
  const catGroups = {};
  if (form.items.length > 0) {
    form.items.forEach(i => {
      if (!catGroups[i.requirement_category]) catGroups[i.requirement_category] = { total: 0, compliant: 0 };
      catGroups[i.requirement_category].total++;
      if (i.is_compliant) catGroups[i.requirement_category].compliant++;
    });
  }

  return (
    <div>
      <div className="page-header">
        <h2>🔍 差距分析</h2>
        <label className="btn" style={{cursor:"pointer", display:"inline-flex", alignItems:"center", gap:"6px", marginRight:"8px"}}>
          <Upload size={16} /> {importing ? "识别中..." : "导入文件识别"}
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileImport} style={{display:"none"}} />
        </label>
        <button className="btn btn-primary" onClick={() => { initItems(); setShowModal(true); }}>
          <Plus size={16} /> 新建差距分析
        </button>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>信息系统</th><th>分析日期</th><th>符合项</th><th>合规率</th><th>状态</th><th>操作</th></tr>
              </thead>
              <tbody>
                {analyses.length === 0 ? (
                  <tr><td colSpan="6" className="empty-state"><h3>暂无差距分析</h3><p>点击"新建差距分析"对照等保要求进行分析</p></td></tr>
                ) : analyses.map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.system_name}</strong></td>
                    <td>{a.analysis_date}</td>
                    <td>{a.overall_score}</td>
                    <td>
                      <div className="progress-bar" style={{ width: '120px' }}>
                        <div className="progress-fill" style={{ width: `${a.compliance_rate}%`, background: a.compliance_rate >= 80 ? 'var(--success)' : a.compliance_rate >= 60 ? 'var(--warning)' : 'var(--danger)' }}></div>
                      </div>
                      <span style={{ fontSize: '12px', marginLeft: '8px' }}>{a.compliance_rate}%</span>
                    </td>
                    <td><span className={`badge ${a.status === 'completed' ? 'badge-green' : a.status === 'in_progress' ? 'badge-blue' : 'badge-gray'}`}>{STATUS_LABELS[a.status] || a.status}</span></td>
                    <td><button className="btn btn-sm" onClick={() => handleView(a.id)}><Eye size={14} /> 查看</button></td>
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
              新建差距分析
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
                    <label>分析日期</label>
                    <input className="form-control" type="date" value={form.analysis_date} onChange={e => setForm({...form, analysis_date: e.target.value})} />
                  </div>
                </div>

                {form.items.length > 0 && (
                  <>
                    <div className="stats-grid" style={{ marginTop: '16px' }}>
                      <div className="stat-card">
                        <div><div className="stat-value">{compliantCount}/{totalCount}</div><div className="stat-label">符合/总计</div></div>
                      </div>
                      <div className="stat-card">
                        <div><div className="stat-value">{Math.round((compliantCount/totalCount)*100)}%</div><div className="stat-label">合规率</div></div>
                      </div>
                    </div>

                    {Object.entries(catGroups).map(([cat, stats]) => (
                      <div key={cat} style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}
                          onClick={() => setExpandedCats({...expandedCats, [cat]: !expandedCats[cat]})}>
                          {expandedCats[cat] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <strong>{cat}</strong>
                          <span className="badge badge-blue">{stats.compliant}/{stats.total} 符合</span>
                          <div className="progress-bar" style={{ width: '100px', margin: 0 }}>
                            <div className="progress-fill" style={{ width: `${(stats.compliant/stats.total)*100}%`, background: 'var(--primary)' }}></div>
                          </div>
                        </div>

                        {expandedCats[cat] && form.items
                          .map((item, idx) => ({ item, idx }))
                          .filter(({ item }) => item.requirement_category === cat)
                          .map(({ item, idx }) => (
                            <div key={idx} style={{ marginBottom: '12px', padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div>
                                  <code>{item.requirement_id}</code>
                                  <strong style={{ marginLeft: '8px' }}>{item.requirement_desc}</strong>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                                  <input type="checkbox" checked={item.is_compliant} onChange={e => updateItem(idx, 'is_compliant', e.target.checked)} />
                                  符合
                                </label>
                              </div>
                              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                期望值: {item.expected_value}
                              </div>
                              <div className="form-row">
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <input className="form-control" placeholder="实际情况描述..." value={item.actual_value} onChange={e => updateItem(idx, 'actual_value', e.target.value)} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <select className="form-control" value={item.risk_level} onChange={e => updateItem(idx, 'risk_level', e.target.value)}>
                                    <option value="high">高风险</option>
                                    <option value="medium">中风险</option>
                                    <option value="low">低风险</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">保存差距分析</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisDetail({ analysis, onBack }) {
  const cats = {};
  (analysis.items || []).forEach(i => {
    if (!cats[i.requirement_category]) cats[i.requirement_category] = [];
    cats[i.requirement_category].push(i);
  });

  return (
    <div>
      <div className="page-header">
        <h2>📊 差距分析详情 - {analysis.system_name}</h2>
        <button className="btn" onClick={onBack}>← 返回</button>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div><div className="stat-value">{analysis.overall_score}</div><div className="stat-label">符合项</div></div>
          </div>
          <div className="stat-card">
            <div><div className="stat-value">{analysis.compliance_rate}%</div><div className="stat-label">合规率</div></div>
          </div>
        </div>
        {Object.entries(cats).map(([cat, items]) => (
          <div key={cat} className="card">
            <div className="card-header">{cat} ({items.filter(i => i.is_compliant).length}/{items.length})</div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>编号</th><th>描述</th><th>期望</th><th>实际</th><th>符合</th><th>风险</th></tr></thead>
                <tbody>
                  {items.map(i => (
                    <tr key={i.id}>
                      <td><code>{i.requirement_id}</code></td>
                      <td>{i.requirement_desc}</td>
                      <td style={{ fontSize: '12px' }}>{i.expected_value}</td>
                      <td style={{ fontSize: '12px' }}>{i.actual_value || '-'}</td>
                      <td>{i.is_compliant ? <span className="badge badge-green">是</span> : <span className="badge badge-red">否</span>}</td>
                      <td><span className={`badge ${RISK_COLORS[i.risk_level]}`}>{RISK_LABELS[i.risk_level] || i.risk_level}</span></td>
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
