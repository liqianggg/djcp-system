import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Upload, X, Image, Search, Filter } from 'lucide-react';

import { apiGet, apiPost, apiPut, apiDelete, apiUpload, hasPermission } from '../api';

const STATUS_LABELS = { preparing: '准备中', submitted: '已提交', approved: '已审批', rejected: '已驳回' };
const STATUS_COLORS = { preparing: 'badge-gray', submitted: 'badge-blue', approved: 'badge-green', rejected: 'badge-red' };

export default function Filing() {
  const [systems, setSystems] = useState([]);
  const [filings, setFilings] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [evidences, setEvidences] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [filterYear, setFilterYear] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [years, setYears] = useState([]);
  const [form, setForm] = useState({
    system_id: '', filing_number: '', filing_authority: '', filing_date: '',
    approval_date: '', filing_status: 'preparing', filing_document: '', remarks: ''
  });

  const loadFilings = () => {
    const params = new URLSearchParams();
    if (filterYear) params.set('year', filterYear);
    if (filterStatus) params.set('status', filterStatus);
    apiGet('/api/filings?' + params).then(d => d && setFilings(d));
  };

  useEffect(() => {
    apiGet('/api/systems').then(setSystems);
    apiGet('/api/filings/years').then(y => y && setYears(y));
    loadFilings();
  }, [filterYear, filterStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editing ? '/api/filings/' + editing.id : '/api/filings';
    const method = editing ? 'PUT' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('djcp_token')}` }, body: JSON.stringify(form) });
    setShowModal(false); setEditing(null);
    setForm({ system_id: '', filing_number: '', filing_authority: '', filing_date: '', approval_date: '', filing_status: 'preparing', filing_document: '', remarks: '' });
    loadFilings();
  };

  const loadEvidences = async (filingId) => {
    const res = await fetch('/api/filings/' + filingId + '/evidences', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('djcp_token') }
    });
    if (res.ok) setEvidences(await res.json());
  };

  const handleEvidenceUpload = async (filingId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = e.target.files;
      if (!files.length) return;
      setUploading(true);
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        await fetch('/api/filings/' + filingId + '/evidences', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('djcp_token') },
          body: fd
        });
      }
      setUploading(false);
      loadEvidences(filingId);
    };
    input.click();
  };

  const handleEvidenceDelete = async (filingId, evId) => {
    if (!confirm('确定删除该备案证明图片吗？')) return;
    await fetch('/api/filings/' + filingId + '/evidences/' + evId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('djcp_token') }
    });
    loadEvidences(filingId);
  };

  const handleEdit = (f) => {
    setEditing(f);
    setForm({
      system_id: f.system_id, filing_number: f.filing_number || '', filing_authority: f.filing_authority || '',
      filing_date: f.filing_date || '', approval_date: f.approval_date || '', filing_status: f.filing_status,
      filing_document: f.filing_document || '', remarks: f.remarks || ''
    });
    setShowModal(true);
    loadEvidences(f.id);
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
        <div className="search-bar" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
            <select className="form-control" value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ minWidth: '100px' }}>
              <option value="">全部年份</option>
              {years.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
            <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ minWidth: '120px' }}>
              <option value="">全部状态</option>
              {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <span>总计 <strong>{filings.length}</strong> 条</span>
            <span style={{color:'#065f46'}}>已审批 <strong>{filings.filter(f=>f.filing_status==='approved').length}</strong></span>
            <span style={{color:'#1d4ed8'}}>已提交 <strong>{filings.filter(f=>f.filing_status==='submitted').length}</strong></span>
            <span style={{color:'#991b1b'}}>已驳回 <strong>{filings.filter(f=>f.filing_status==='rejected').length}</strong></span>
          </div>
        </div>
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
              <button className="btn btn-sm" onClick={() => { setShowModal(false); setEvidences([]); }}>✕</button>
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
                {editing && (
                  <div className="form-group">
                    <label>📸 备案证明图片</label>
                    <div style={{ border: '1px dashed var(--border)', borderRadius: '8px', padding: '12px', background: '#fafafa' }}>
                      <button type="button" className="btn btn-sm" style={{ marginBottom: '12px' }} onClick={() => handleEvidenceUpload(editing.id)} disabled={uploading}>
                        <Upload size={14} /> {uploading ? '上传中...' : '上传证明图片'}
                      </button>
                      {evidences.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
                          {evidences.map(ev => (
                            <div key={ev.id} style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', background: '#fff' }}>
                              <img
                                src={'/api/filings/' + editing.id + '/evidences/' + ev.id + '/file?token=' + localStorage.getItem('djcp_token')}
                                alt={ev.original_name}
                                style={{ width: '100%', height: '90px', objectFit: 'cover', cursor: 'pointer' }}
                                onClick={() => window.open('/api/filings/' + editing.id + '/evidences/' + ev.id + '/file?token=' + localStorage.getItem('djcp_token'), '_blank')}
                                title={ev.original_name}
                              />
                              <button type="button"
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
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>暂无证明图片，点击上方按钮上传</p>
                      )}
                    </div>
                  </div>
                )}

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
