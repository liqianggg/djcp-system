import React, { useState, useEffect } from 'react';
import { Plus, Edit2, CheckCircle, Upload, X, Trash2 } from 'lucide-react';

import { apiGet, apiPost, apiPut, apiDelete, apiUpload, hasPermission } from '../api';

const PRIORITY_LABELS = { urgent: '紧急', high: '高', medium: '中', low: '低' };
const PRIORITY_COLORS = { urgent: 'badge-red', high: 'badge-yellow', medium: 'badge-blue', low: 'badge-gray' };
const STATUS_LABELS = { pending: '待处理', in_progress: '进行中', completed: '已完成', verified: '已验证' };
const STATUS_COLORS = { pending: 'badge-gray', in_progress: 'badge-blue', completed: 'badge-green', verified: 'badge-green' };

const emptyForm = {
  system_id: '', gap_item_id: '', title: '', description: '', responsible_person: '',
  priority: 'medium', plan_start_date: '', plan_end_date: '', cost: 0, remarks: ''
};

export default function Rectification() {
  const [systems, setSystems] = useState([]);
  const [rectifications, setRectifications] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [evidences, setEvidences] = useState([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  const loadRectifications = async () => {
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterPriority) params.set('priority', filterPriority);
    const data = await apiGet('/api/rectifications?' + params);
    if (data) setRectifications(data);
  };

  const loadEvidences = async (rectId) => {
    const data = await apiGet('/api/rectifications/' + rectId + '/evidences');
    if (data) setEvidences(data);
  };

  useEffect(() => {
    apiGet('/api/systems').then(setSystems);
    loadRectifications();
  }, [filterStatus, filterPriority]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editing ? '/api/rectifications/' + editing.id : '/api/rectifications';
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? {
      title: form.title, description: form.description, responsible_person: form.responsible_person,
      priority: form.priority, status: form.status, plan_start_date: form.plan_start_date,
      plan_end_date: form.plan_end_date, actual_start_date: form.actual_start_date,
      actual_end_date: form.actual_end_date, cost: form.cost, evidence: form.evidence, remarks: form.remarks
    } : form;
    await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('djcp_token')}` }, body: JSON.stringify(body) });
    setShowModal(false); setEditing(null); setForm(emptyForm);
    loadRectifications();
  };

  const handleEdit = (r) => {
    setEditing(r);
    setForm({
      system_id: r.system_id, gap_item_id: r.gap_item_id || '', title: r.title, description: r.description || '',
      responsible_person: r.responsible_person || '', priority: r.priority, status: r.status,
      plan_start_date: r.plan_start_date || '', plan_end_date: r.plan_end_date || '',
      actual_start_date: r.actual_start_date || '', actual_end_date: r.actual_end_date || '',
      cost: r.cost || 0, evidence: r.evidence || '', remarks: r.remarks || ''
    });
    setShowModal(true);
    loadEvidences(r.id);
  };


  const handleEvidenceUpload = async (rectId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = e.target.files;
      if (!files.length) return;
      setUploadingEvidence(true);
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        await apiUpload('/api/rectifications/' + rectId + '/evidences', fd);
      }
      setUploadingEvidence(false);
      loadEvidences(rectId);
    };
    input.click();
  };

  const handleStatusChange = async (rect, newStatus) => {
    await fetch('/api/rectifications/' + rect.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('djcp_token')}` },
      body: JSON.stringify({
        title: rect.title, description: rect.description, responsible_person: rect.responsible_person,
        priority: rect.priority, status: newStatus, plan_start_date: rect.plan_start_date,
        plan_end_date: rect.plan_end_date, actual_start_date: newStatus === 'in_progress' && !rect.actual_start_date ? new Date().toISOString().split('T')[0] : rect.actual_start_date,
        actual_end_date: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : rect.actual_end_date,
        cost: rect.cost, evidence: rect.evidence, remarks: rect.remarks
      })
    });
    loadRectifications();
  };


  const handleEvidenceDelete = async (rectId, evId) => {
    if (!confirm('确定删除该截图吗？')) return;
    await apiDelete('/api/rectifications/' + rectId + '/evidences/' + evId);
    loadEvidences(rectId);
  };

  const totalCost = rectifications.reduce((sum, r) => sum + (r.cost || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h2>🔧 整改管理</h2>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }}>
          <Plus size={16} /> 新建整改任务
        </button>
      </div>

      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div><div className="stat-value">{rectifications.length}</div><div className="stat-label">总任务数</div></div>
          </div>
          <div className="stat-card">
            <div><div className="stat-value">{rectifications.filter(r => r.status === 'pending').length}</div><div className="stat-label">待处理</div></div>
          </div>
          <div className="stat-card">
            <div><div className="stat-value">{rectifications.filter(r => r.status === 'in_progress').length}</div><div className="stat-label">进行中</div></div>
          </div>
          <div className="stat-card">
            <div><div className="stat-value">{rectifications.filter(r => r.status === 'completed' || r.status === 'verified').length}</div><div className="stat-label">已完成</div></div>
          </div>
          <div className="stat-card">
            <div><div className="stat-value">¥{totalCost.toLocaleString()}</div><div className="stat-label">总投入</div></div>
          </div>
        </div>

        <div className="search-bar">
          <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="form-control" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="">全部优先级</option>
            {Object.entries(PRIORITY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>系统</th><th>任务标题</th><th>负责人</th><th>优先级</th><th>状态</th><th>计划开始</th><th>计划完成</th><th>费用</th><th>操作</th></tr>
              </thead>
              <tbody>
                {rectifications.length === 0 ? (
                  <tr><td colSpan="9" className="empty-state"><h3>暂无整改任务</h3><p>点击"新建整改任务"添加安全整改任务</p></td></tr>
                ) : rectifications.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.system_name}</strong></td>
                    <td>{r.title}</td>
                    <td>{r.responsible_person || '-'}</td>
                    <td><span className={`badge ${PRIORITY_COLORS[r.priority]}`}>{PRIORITY_LABELS[r.priority]}</span></td>
                    <td><span className={`badge ${STATUS_COLORS[r.status]}`}>{STATUS_LABELS[r.status]}</span></td>
                    <td>{r.plan_start_date || '-'}</td>
                    <td>{r.plan_end_date || '-'}</td>
                    <td>{r.cost > 0 ? '¥' + r.cost.toLocaleString() : '-'}</td>
                    <td>
                      <div className="toolbar">
                        <button className="btn btn-sm" onClick={() => handleEdit(r)}><Edit2 size={14} /></button>
                        {r.status === 'pending' && (
                          <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(r, 'in_progress')}>开始</button>
                        )}
                        {r.status === 'in_progress' && (
                          <button className="btn btn-sm btn-success" onClick={() => handleStatusChange(r, 'completed')}><CheckCircle size={14} /> 完成</button>
                        )}
                        {r.status === 'completed' && (
                          <button className="btn btn-sm btn-success" onClick={() => handleStatusChange(r, 'verified')}>验证</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              {editing ? '编辑整改任务' : '新建整改任务'}
              <button className="btn btn-sm" onClick={() => { setShowModal(false); setEvidences([]); }}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>任务标题 *</label>
                  <input className="form-control" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="如: 部署WAF防火墙" />
                </div>
                {!editing && (
                  <div className="form-group">
                    <label>信息系统 *</label>
                    <select className="form-control" required value={form.system_id} onChange={e => setForm({...form, system_id: e.target.value})}>
                      <option value="">请选择</option>
                      {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>负责人</label>
                    <input className="form-control" value={form.responsible_person} onChange={e => setForm({...form, responsible_person: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>优先级</label>
                    <select className="form-control" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                      {Object.entries(PRIORITY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                {editing && (
                  <div className="form-group">
                    <label>状态</label>
                    <select className="form-control" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                      {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>计划开始日期</label>
                    <input className="form-control" type="date" value={form.plan_start_date} onChange={e => setForm({...form, plan_start_date: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>计划完成日期</label>
                    <input className="form-control" type="date" value={form.plan_end_date} onChange={e => setForm({...form, plan_end_date: e.target.value})} />
                  </div>
                </div>
                {editing && (form.status === 'in_progress' || form.status === 'completed' || form.status === 'verified') && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>实际开始日期</label>
                      <input className="form-control" type="date" value={form.actual_start_date} onChange={e => setForm({...form, actual_start_date: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>实际完成日期</label>
                      <input className="form-control" type="date" value={form.actual_end_date} onChange={e => setForm({...form, actual_end_date: e.target.value})} />
                    </div>
                  </div>
                )}
                {editing && (
                  <>
                    <div className="form-group">
                      <label>整改证据说明</label>
                      <textarea className="form-control" value={form.evidence || ''} onChange={e => setForm({...form, evidence: e.target.value})} placeholder="整改措施说明和文字证明材料..."></textarea>
                    </div>
                    <div className="form-group">
                      <label>📸 整改截图</label>
                      <div style={{ border: '1px dashed var(--border)', borderRadius: '8px', padding: '12px', background: '#fafafa' }}>
                        <button type="button" className="btn btn-sm" style={{ marginBottom: '12px' }} onClick={() => handleEvidenceUpload(editing.id)} disabled={uploadingEvidence}>
                          <Upload size={14} /> {uploadingEvidence ? '上传中...' : '上传截图'}
                        </button>
                        {evidences.length > 0 ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
                            {evidences.map(ev => (
                              <div key={ev.id} style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', background: '#fff' }}>
                                <img
                                  src={'/api/rectifications/' + editing.id + '/evidences/' + ev.id + '/file'}
                                  alt={ev.original_name}
                                  style={{ width: '100%', height: '90px', objectFit: 'cover', cursor: 'pointer' }}
                                  onClick={() => window.open('/api/rectifications/' + editing.id + '/evidences/' + ev.id + '/file', '_blank')}
                                  title={ev.original_name}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleEvidenceDelete(editing.id, ev.id)}
                                  style={{ position: 'absolute', top: '3px', right: '3px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(239,68,68,0.85)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}
                                  title="删除"
                                ><X size={12} /></button>
                                <div style={{ padding: '4px 6px', fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ev.original_name}>
                                  {ev.original_name.length > 14 ? ev.original_name.slice(0, 14) + '...' : ev.original_name}
                                </div>
                                <div style={{ padding: '0 6px 4px', fontSize: '10px', color: '#999' }}>{ev.uploaded_by}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>暂无截图，点击上方按钮上传</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>预估费用 (元)</label>
                    <input className="form-control" type="number" value={form.cost} onChange={e => setForm({...form, cost: parseFloat(e.target.value) || 0})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>任务描述</label>
                  <textarea className="form-control" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="详细描述整改内容、措施和目标..."></textarea>
                </div>
                <div className="form-group">
                  <label>备注</label>
                  <textarea className="form-control" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})}></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">{editing ? '保存修改' : '创建任务'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
