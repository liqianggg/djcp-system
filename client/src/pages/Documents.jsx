import React, { useState, useEffect, useRef } from 'react';
import { Plus, Upload, Download, Edit2, Trash2, FolderOpen, Eye } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete, apiUpload, hasPermission, fetchBlobUrl, fetchDownload } from '../api';
import { PageShell, Toolbar, FilterSelect, EmptyState, Modal, ConfirmDialog } from '../components';
import { useToast } from '../hooks/useToast';

const DOC_TYPES = { policy:'管理制度', procedure:'操作规程', record:'记录表单', report:'测评报告', evidence:'整改证据', other:'其他' };
const DOC_CLASS = { policy:'badge-blue', procedure:'badge-blue', record:'badge-gray', report:'badge-yellow', evidence:'badge-green', other:'badge-gray' };
const STATUS_LABELS = { draft:'草稿', reviewed:'已审核', approved:'已批准', archived:'已归档' };
const STATUS_CLASS = { draft:'badge-gray', reviewed:'badge-blue', approved:'badge-green', archived:'badge-gray' };

export default function Documents() {
  const [systems, setSystems] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const fileRef = useRef(null);
  const [form, setForm] = useState({ system_id:'', title:'', doc_type:'policy', version:'1.0', status:'draft', description:'', keywords:'' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const load = () => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (filterType) p.set('type', filterType);
    apiGet('/api/documents?'+p).then(setDocuments);
  };
  useEffect(() => { apiGet('/api/systems').then(setSystems); load(); }, [search, filterType]);

  const openCreate = () => { setEditing(null); setForm({ system_id:'', title:'', doc_type:'policy', version:'1.0', status:'draft', description:'', keywords:'' }); setShowModal(true); };
  const openEdit = (d) => { setEditing(d); setForm({ system_id:d.system_id||'', title:d.title, doc_type:d.doc_type, version:d.version, status:d.status, description:d.description||'', keywords:d.keywords||'' }); setShowModal(true); };

  const isAdmin = () => {
    try { const user = JSON.parse(localStorage.getItem('djcp_user') || '{}'); return user.role === 'system_admin'; }
    catch { return false; }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await apiPut('/api/documents/'+editing.id, form);
      } else {
        if (!fileRef.current?.files?.length) { toast.error('请选择要上传的文件'); setSubmitting(false); return; }
        const fd = new FormData();
        fd.append('file', fileRef.current.files[0]);
        fd.append('system_id', form.system_id || '');
        fd.append('title', form.title);
        fd.append('doc_type', form.doc_type);
        fd.append('version', form.version);
        fd.append('description', form.description || '');
        fd.append('keywords', form.keywords || '');
        fd.append('status', form.status);
        await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('djcp_token') },
          body: fd
        });
      }
      setShowModal(false); setEditing(null);
      toast.success(editing ? '文档已更新' : '文档已上传');
      load();
    } catch (err) {
      toast.error(err.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiDelete('/api/documents/' + deleteTarget);
      toast.success('文档已删除');
      load();
    } catch (err) {
      toast.error(err.message || '删除失败');
    }
    setDeleteTarget(null);
  };

  const handleFileUpload = async (docId) => {
    if (!fileRef.current?.files?.length) return;
    setUploading(true);
    const fd = new FormData(); fd.append('file', fileRef.current.files[0]);
    await apiUpload('/api/documents/'+docId+'/upload', fd);
    setUploading(false); load();
  };

  const typeOpts = Object.entries(DOC_TYPES).map(([k,v])=>({value:k,label:v}));

  return (
    <PageShell title="文档管理" actions={isAdmin() && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> 上传文档</button>}>
      <Toolbar
        searchPlaceholder="搜索文档标题..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={<FilterSelect value={filterType} onChange={setFilterType} options={typeOpts} placeholder="全部类型" />}
      />

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead><tr><th>标题</th><th>类型</th><th>版本</th><th>状态</th><th>关联系统</th><th>上传者</th><th>更新时间</th><th style={{width:'120px'}}>操作</th></tr></thead>
            <tbody>
              {documents.length===0 ? (
                <tr><td colSpan={8}><EmptyState icon={<FolderOpen size={32} />} title="暂无文档" /></td></tr>
              ) : documents.map(d => (
                <tr key={d.id}>
                  <td><strong>{d.title}</strong></td>
                  <td><span className={`badge ${DOC_CLASS[d.doc_type]}`}>{DOC_TYPES[d.doc_type]||d.doc_type}</span></td>
                  <td style={{color:'var(--text-secondary)'}}>v{d.version}</td>
                  <td><span className={`badge ${STATUS_CLASS[d.status]}`}>{STATUS_LABELS[d.status]}</span></td>
                  <td style={{fontSize:'12px',color:'var(--text-secondary)'}}>{d.system_name||'-'}</td>
                  <td style={{fontSize:'12px',color:'var(--text-secondary)'}}>{d.uploaded_by||'-'}</td>
                  <td style={{fontSize:'12px',color:'var(--text-secondary)'}}>{d.updated_at||d.created_at||'-'}</td>
                  <td><div className="toolbar">
                    {d.file_path && <button className="btn btn-sm" onClick={async () => {
                      const u = await fetchBlobUrl('/api/documents/'+d.id+'/preview');
                      window.open(u, '_blank');
                    }} title="预览"><Eye size={13} /></button>}
                    {d.file_path && <button className="btn btn-sm" onClick={() => fetchDownload('/api/documents/'+d.id+'/download', d.title)} title="下载"><Download size={13} /></button>}
                    {hasPermission('document:edit') && <button className="btn btn-sm" onClick={() => openEdit(d)} title="编辑"><Edit2 size={13} /></button>}
                    {hasPermission('document:delete') && <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(d.id)} title="删除"><Trash2 size={13} /></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing?'编辑文档':'新建文档'} width="560px"
        footer={<><button className="btn" onClick={() => setShowModal(false)} disabled={submitting}>取消</button><button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>{submitting ? '保存中...' : (editing?'保存':'创建')}</button></>}
      >
        <form onSubmit={handleSubmit}>
          {!editing && (
            <div className="form-group">
              <label>选择文件 *</label>
              <input ref={fileRef} type="file" className="form-control" required style={{ padding:'6px' }} />
            </div>
          )}
          {editing && isAdmin() && (
            <div className="form-group">
              <label>替换文件</label>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                <input ref={fileRef} type="file" className="form-control" style={{ padding:'6px', flex:1 }} />
                <button type="button" className="btn btn-sm" onClick={() => handleFileUpload(editing.id)} disabled={uploading}>
                  <Upload size={13} /> {uploading ? '替换中...' : '替换'}
                </button>
              </div>
            </div>
          )}
          <div className="form-group"><label>文档标题 *</label><input className="form-control" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></div>
          <div className="form-row">
            <div className="form-group"><label>文档类型</label><select className="form-control" value={form.doc_type} onChange={e=>setForm({...form,doc_type:e.target.value})}>{Object.entries(DOC_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
            <div className="form-group"><label>版本号</label><input className="form-control" value={form.version} onChange={e=>setForm({...form,version:e.target.value})} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>关联系统</label><select className="form-control" value={form.system_id} onChange={e=>setForm({...form,system_id:e.target.value})}><option value="">不关联</option>{systems.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="form-group"><label>状态</label><select className="form-control" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div className="form-group"><label>描述</label><textarea className="form-control" rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></div>
          <div className="form-group"><label>关键词</label><input className="form-control" value={form.keywords} onChange={e=>setForm({...form,keywords:e.target.value})} placeholder="逗号分隔" /></div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除文档"
        message="确定要删除该文档吗？此操作不可撤销。"
        confirmText="删除"
        danger
      />
    </PageShell>
  );
}
