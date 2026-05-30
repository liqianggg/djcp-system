import React, { useState, useEffect } from 'react';
import { Plus, Edit2 } from 'lucide-react';

import { apiGet, apiPost, apiPut, apiDelete, apiUpload, hasPermission } from '../api';

const STATUS_LABELS = { preparing: '准备中', submitted: '已提交', approved: '已审批', rejected: '已驳回' };
const STATUS_COLORS = { preparing: 'badge-gray', submitted: 'badge-blue', approved: 'badge-green', rejected: 'badge-red' };

export default function Filing() {
  const [systems, setSystems] = useState([]);
  const [filings, setFilings] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    system_id: '', filing_number: '', filing_authority: '', filing_date: '',
    approval_date: '', filing_status: 'preparing', filing_document: '', remarks: ''
  });

  const loadFilings = () => {
    apiGet('/api/filings').then(setFilings);
  };

  useEffect(() => {
    apiGet('/api/systems').then(setSystems);
    loadFilings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editing ? API + '/api/filings/' + editing.id : API + '/api/filings';
    const method = editing ? 'PUT' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('djcp_token')}` }, body: JSON.stringify(form) });
    setShowModal(false); setEditing(null);
    setForm({ system_id: '', filing_number: '', filing_authority: '', filing_date: '', approval_date: '', filing_status: 'preparing', filing_document: '', remarks: '' });
    loadFilings();
  };

  const handleEdit = (f) => {
    setEditing(f);
    setForm({
      system_id: f.system_id, filing_number: f.filing_number || '', filing_authority: f.filing_authority || '',
      filing_date: f.filing_date || '', approval_date: f.approval_date || '', filing_status: f.filing_status,
      filing_document: f.filing_document || '', remarks: f.remarks || ''
    });
    setShowModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <h2>📄 备案管理</h2>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({...form, system_id:'', filing_status:'preparing'}); setShowModal(true); }}>
          <Plus size={16} /> 新建备案
        </button>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>信息系统</th><th>备案编号</th><th>备案机关</th><th>备案日期</th><th>审批日期</th><th>状态</th><th>操作</th></tr>
              </thead>
              <tbody>
                {filings.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state"><h3>暂无备案记录</h3><p>点击"新建备案"向公安机关提交安全等级保护备案</p></td></tr>
                ) : filings.map(f => (
                  <tr key={f.id}>
                    <td><strong>{f.system_name}</strong></td>
                    <td><code>{f.filing_number || '-'}</code></td>
                    <td>{f.filing_authority || '-'}</td>
                    <td>{f.filing_date || '-'}</td>
                    <td>{f.approval_date || '-'}</td>
                    <td><span className={`badge ${STATUS_COLORS[f.filing_status]}`}>{STATUS_LABELS[f.filing_status]}</span></td>
                    <td>
                      <button className="btn btn-sm" onClick={() => handleEdit(f)}><Edit2 size={14} /> 编辑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-header">📋 备案流程说明</div>
          <div className="card-body">
            <div className="timeline">
              <div className="timeline-item">
                <div className="time">第一步</div>
                <div className="content"><strong>准备备案材料</strong> - 包括定级报告、系统拓扑图、安全管理制度等</div>
              </div>
              <div className="timeline-item">
                <div className="time">第二步</div>
                <div className="content"><strong>提交备案申请</strong> - 向所在地设区的市级以上公安机关提交备案材料</div>
              </div>
              <div className="timeline-item">
                <div className="time">第三步</div>
                <div className="content"><strong>公安机关审核</strong> - 公安机关对备案材料进行审核</div>
              </div>
              <div className="timeline-item">
                <div className="time">第四步</div>
                <div className="content"><strong>获取备案证明</strong> - 审核通过后获取《信息系统安全等级保护备案证明》</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              {editing ? '编辑备案' : '新建备案'}
              <button className="btn btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>信息系统 *</label>
                  <select className="form-control" required value={form.system_id} onChange={e => setForm({...form, system_id: e.target.value})} disabled={!!editing}>
                    <option value="">请选择</option>
                    {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>备案编号</label>
                    <input className="form-control" value={form.filing_number} onChange={e => setForm({...form, filing_number: e.target.value})} placeholder="公安机关分配" />
                  </div>
                  <div className="form-group">
                    <label>备案状态</label>
                    <select className="form-control" value={form.filing_status} onChange={e => setForm({...form, filing_status: e.target.value})}>
                      {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>备案机关</label>
                    <input className="form-control" value={form.filing_authority} onChange={e => setForm({...form, filing_authority: e.target.value})} placeholder="如: XX市公安局网安支队" />
                  </div>
                  <div className="form-group">
                    <label>备案日期</label>
                    <input className="form-control" type="date" value={form.filing_date} onChange={e => setForm({...form, filing_date: e.target.value})} />
                  </div>
                </div>
                {form.filing_status === 'approved' && (
                  <div className="form-group">
                    <label>审批日期</label>
                    <input className="form-control" type="date" value={form.approval_date} onChange={e => setForm({...form, approval_date: e.target.value})} />
                  </div>
                )}
                <div className="form-group">
                  <label>备案材料说明</label>
                  <textarea className="form-control" value={form.filing_document} onChange={e => setForm({...form, filing_document: e.target.value})} placeholder="备案材料清单及说明..."></textarea>
                </div>
                <div className="form-group">
                  <label>备注</label>
                  <textarea className="form-control" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} placeholder="其他需要说明的事项..."></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">{editing ? '保存修改' : '提交备案'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
