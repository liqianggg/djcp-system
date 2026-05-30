import React, { useState, useEffect, useRef } from 'react';
import { Plus, Upload, Download, Edit2, Trash2, Search } from 'lucide-react';

import { apiGet, apiPost, apiPut, apiDelete, apiUpload, hasPermission } from '../api';

const DOC_TYPES = { policy: '管理制度', procedure: '操作规程', record: '记录表单', report: '测评报告', evidence: '整改证据', other: '其他' };
const DOC_COLORS = { policy: 'badge-blue', procedure: 'badge-blue', record: 'badge-gray', report: 'badge-yellow', evidence: 'badge-green', other: 'badge-gray' };
const STATUS_LABELS = { draft: '草稿', reviewed: '已审核', approved: '已批准', archived: '已归档' };
const STATUS_COLORS = { draft: 'badge-gray', reviewed: 'badge-blue', approved: 'badge-green', archived: 'badge-gray' };

export default function Documents() {
  const [systems, setSystems] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    system_id: '', title: '', doc_type: 'policy', version: '1.0',
    status: 'draft', description: '', 
  });
  const [uploadFile, setUploadFile] = useState(null);

  const loadDocuments = () => {
    const params = new URLSearchParams();
    if (filterType) params.set('doc_type', filterType);
    fetch('/api/documents?' + params, { headers: { 'Authorization': `Bearer ${localStorage.getItem('djcp_token')}` } }).then(r => r.json()).then(docs => {
      if (search) docs = docs.filter(d => d.title.toLowerCase().includes(search.toLowerCase()) || (d.system_name && d.system_name.toLowerCase().includes(search.toLowerCase())));
      setDocuments(docs);
    });
  };

  useEffect(() => {
    apiGet('/api/systems').then(setSystems);
    loadDocuments();
  }, [filterType, search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) {
      await fetch('/api/documents/' + editing.id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('djcp_token')}` },
        body: JSON.stringify({ title: form.title, doc_type: form.doc_type, version: form.version, status: form.status, description: form.description })
      });
    } else {
      const fd = new FormData();
      fd.append('system_id', form.system_id);
      fd.append('title', form.title);
      fd.append('doc_type', form.doc_type);
      fd.append('version', form.version);
      fd.append('description', form.description);
      fd.append('uploaded_by', form.uploaded_by);
      if (uploadFile) fd.append('file', uploadFile);
      await apiUpload('/api/documents', fd);
    }
    setShowModal(false); setEditing(null);
    setForm({ system_id: '', title: '', doc_type: 'policy', version: '1.0', status: 'draft', description: '' });
    setUploadFile(null);
    loadDocuments();
  };

  const handleEdit = (d) => {
    setEditing(d);
    setForm({ system_id: d.system_id || '', title: d.title, doc_type: d.doc_type, version: d.version, status: d.status, description: d.description || '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除此文档吗？')) return;
    await fetch('/api/documents/' + id, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('djcp_token')}` } });
    loadDocuments();
  };

  const formatSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  return (
    <div>
      <div className="page-header">
        <h2>📁 文档管理</h2>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({...form, system_id: '', title: '', doc_type: 'policy', version: '1.0', status: 'draft', description: ''}); setUploadFile(null); setShowModal(true); }}>
          <Plus size={16} /> 上传文档
        </button>
      </div>

      <div className="page-body">
        <div className="search-bar">
          <Search size={16} style={{ color: 'var(--text-secondary)' }} />
          <input className="form-control" placeholder="搜索文档名称..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-control" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">全部类型</option>
            {Object.entries(DOC_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>文档名称</th><th>关联系统</th><th>类型</th><th>版本</th><th>大小</th><th>状态</th><th>上传人</th><th>时间</th><th>操作</th></tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr><td colSpan="9" className="empty-state"><h3>暂无文档</h3><p>点击"上传文档"添加安全相关文档</p></td></tr>
                ) : documents.map(d => (
                  <tr key={d.id}>
                    <td><strong>{d.title}</strong></td>
                    <td>{d.system_name || '-'}</td>
                    <td><span className={`badge ${DOC_COLORS[d.doc_type]}`}>{DOC_TYPES[d.doc_type]}</span></td>
                    <td>v{d.version}</td>
                    <td>{formatSize(d.file_size)}</td>
                    <td><span className={`badge ${STATUS_COLORS[d.status]}`}>{STATUS_LABELS[d.status]}</span></td>
                    <td>{d.uploaded_by || '-'}</td>
                    <td style={{ fontSize: '12px' }}>{d.uploaded_at}</td>
                    <td>
                      <div className="toolbar">
                        {d.file_path && (
                          <a href={API + '/api/documents/' + d.id + '/download'} className="btn btn-sm" title="下载"><Download size={14} /></a>
                        )}
                        <button className="btn btn-sm" onClick={() => handleEdit(d)}><Edit2 size={14} /></button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(d.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-header">📋 等保测评常用文档清单</div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { type: 'policy', items: ['信息安全总体方针', '安全策略文件', '安全管理制度汇编', '岗位职责说明'] },
                { type: 'procedure', items: ['系统运维操作规程', '备份恢复操作规程', '应急响应操作规程', '变更管理规程'] },
                { type: 'record', items: ['安全审计日志', '访问控制记录', '设备巡检记录', '培训签到记录'] },
                { type: 'report', items: ['定级报告', '差距分析报告', '测评报告', '整改报告', '风险评估报告'] },
              ].map(grp => (
                <div key={grp.type} style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px' }}>
                  <h4 style={{ marginBottom: '8px', color: 'var(--primary)' }}><span className={`badge ${DOC_COLORS[grp.type]}`} style={{ marginRight: '8px' }}>{DOC_TYPES[grp.type]}</span></h4>
                  <ul style={{ paddingLeft: '20px', fontSize: '14px' }}>
                    {grp.items.map((item, i) => <li key={i} style={{ marginBottom: '4px' }}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              {editing ? '编辑文档' : '上传文档'}
              <button className="btn btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>文档名称 *</label>
                  <input className="form-control" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>关联系统</label>
                    <select className="form-control" value={form.system_id} onChange={e => setForm({...form, system_id: e.target.value})}>
                      <option value="">不关联（通用文档）</option>
                      {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>文档类型</label>
                    <select className="form-control" value={form.doc_type} onChange={e => setForm({...form, doc_type: e.target.value})}>
                      {Object.entries(DOC_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>版本号</label>
                    <input className="form-control" value={form.version} onChange={e => setForm({...form, version: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>状态</label>
                    <select className="form-control" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                      {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                {!editing && (
                  <>
                    <div className="form-group">
                      <label>上传文件</label>
                      <input type="file" ref={fileRef} onChange={e => setUploadFile(e.target.files[0])} style={{ display: 'block' }} />
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label>描述</label>
                  <textarea className="form-control" value={form.description} onChange={e => setForm({...form, description: e.target.value})}></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">{editing ? '保存' : '上传'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
