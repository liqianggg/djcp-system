import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Upload, X, Image, Download } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete, apiUpload, hasPermission, fetchBlobUrl } from '../api';
import { PageShell, Toolbar, FilterSelect, EmptyState, Modal, AuthImage, ConfirmDialog } from '../components';
import { useToast } from '../hooks/useToast';

const STATUS_LABELS = { preparing: '准备中', submitted: '已提交', approved: '已审批', rejected: '已驳回' };
const STATUS_CLASS = { preparing: 'badge-gray', submitted: 'badge-blue', approved: 'badge-green', rejected: 'badge-red' };

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
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();
  const [form, setForm] = useState({ system_id:'', filing_number:'', filing_authority:'', filing_date:'', approval_date:'', filing_status:'preparing', filing_year:new Date().getFullYear(), remarks:'' });

  const loadFilings = () => {
    const p = new URLSearchParams();
    if (filterYear) p.set('year', filterYear);
    if (filterStatus) p.set('status', filterStatus);
    apiGet('/api/filings?'+p).then(data => { if(data) setFilings(Array.isArray(data)?data:(data.filings||[])); });
  };
  useEffect(() => {
    apiGet('/api/systems').then(setSystems);
    apiGet('/api/filings/years').then(y => y && setYears(y));
  }, []);
  useEffect(() => { loadFilings(); }, [filterYear, filterStatus]);

  const openCreate = () => { setEditing(null); setForm({ system_id:'', filing_number:'', filing_authority:'', filing_date:'', approval_date:'', filing_status:'preparing', filing_year:new Date().getFullYear(), remarks:'' }); setEvidences([]); setShowModal(true); };
  const openEdit = (f) => { setEditing(f); setForm({ system_id:f.system_id, filing_number:f.filing_number, filing_authority:f.filing_authority, filing_date:f.filing_date, approval_date:f.approval_date, filing_status:f.filing_status, filing_year:f.filing_year, remarks:f.remarks||'' }); apiGet('/api/filings/'+f.id+'/evidences').then(setEvidences); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      editing ? await apiPut('/api/filings/'+editing.id, form) : await apiPost('/api/filings', form);
      setShowModal(false); setEditing(null);
      toast.success(editing ? '备案已更新' : '备案已创建');
      loadFilings();
    } catch (err) {
      toast.error(err.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiDelete('/api/filings/' + deleteTarget);
      toast.success('备案已删除');
      loadFilings();
    } catch (err) {
      toast.error(err.message || '删除失败');
    }
    setDeleteTarget(null);
  };

  const handleUpload = async (filingId) => {
    const input = document.createElement('input'); input.type='file'; input.accept='image/*'; input.multiple=true;
    input.onchange = async (e) => {
      if(!e.target.files.length)return; setUploading(true);
      try {
        for(const f of e.target.files){ const fd=new FormData(); fd.append('file',f); await apiUpload('/api/filings/'+filingId+'/evidences',fd); }
        toast.success('证明已上传');
      } catch (err) {
        toast.error('上传失败');
      }
      setUploading(false); apiGet('/api/filings/'+filingId+'/evidences').then(setEvidences);
    };
    input.click();
  };

  const deleteEvidence = async (filingId, evId) => {
    if(!confirm('删除该证明图片？'))return;
    await fetch('/api/filings/'+filingId+'/evidences/'+evId,{method:'DELETE',headers:{'Authorization':`Bearer ${localStorage.getItem('djcp_token')}`}});
    apiGet('/api/filings/'+filingId+'/evidences').then(setEvidences);
  };

  const statusOpts = Object.entries(STATUS_LABELS).map(([k,v])=>({value:k,label:v}));
  const yearOpts = (years||[]).map(y=>({value:String(y),label:String(y)}));

  return (
    <PageShell title="备案管理" actions={hasPermission('filing:create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> 新建备案</button>}>
      <Toolbar
        filters={<>
          <FilterSelect value={filterYear} onChange={setFilterYear} options={yearOpts} placeholder="全部年份" />
          <FilterSelect value={filterStatus} onChange={setFilterStatus} options={statusOpts} placeholder="全部状态" />
        </>}
      />

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead><tr><th>备案编号</th><th>信息系统</th><th>备案机关</th><th>年份</th><th>状态</th><th>备案日期</th><th style={{width:'100px'}}>操作</th></tr></thead>
            <tbody>
              {filings.length===0 ? (
                <tr><td colSpan={7}><EmptyState title="暂无备案记录" /></td></tr>
              ) : filings.map(f => (
                <tr key={f.id}>
                  <td><strong>{f.filing_number}</strong></td><td>{f.system_name}</td><td>{f.filing_authority||'-'}</td>
                  <td><span className="badge badge-gray">{f.filing_year}</span></td>
                  <td><span className={`badge ${STATUS_CLASS[f.filing_status]}`}>{STATUS_LABELS[f.filing_status]}</span></td>
                  <td style={{fontSize:'12px',color:'var(--text-secondary)'}}>{f.filing_date||'-'}</td>
                  <td><div className="toolbar">
                    {f.proof_image_count>0 && <span className="badge badge-green" style={{cursor:'pointer'}} onClick={() => openEdit(f)} title="查看证明"><Image size={12} /> {f.proof_image_count}</span>}
                    {hasPermission('filing:edit') && <button className="btn btn-sm" onClick={() => openEdit(f)}><Edit2 size={13} /></button>}
                    {hasPermission('filing:delete') && <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(f.id)}><X size={13} /></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing?'编辑备案':'新建备案'} width="600px"
        footer={<><button className="btn" onClick={() => setShowModal(false)} disabled={submitting}>取消</button><button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>{submitting ? '保存中...' : (editing?'保存':'创建')}</button></>}
      >
        <form onSubmit={handleSubmit}>
          {!editing && <div className="form-group"><label>信息系统 *</label><select className="form-control" required value={form.system_id} onChange={e=>setForm({...form,system_id:e.target.value})}><option value="">请选择</option>{systems.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
          <div className="form-row">
            <div className="form-group"><label>备案编号 *</label><input className="form-control" required value={form.filing_number} onChange={e=>setForm({...form,filing_number:e.target.value})} /></div>
            <div className="form-group"><label>备案机关</label><input className="form-control" value={form.filing_authority} onChange={e=>setForm({...form,filing_authority:e.target.value})} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>备案日期</label><input className="form-control" type="date" value={form.filing_date} onChange={e=>setForm({...form,filing_date:e.target.value})} /></div>
            <div className="form-group"><label>审批日期</label><input className="form-control" type="date" value={form.approval_date} onChange={e=>setForm({...form,approval_date:e.target.value})} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>备案年份</label><input className="form-control" type="number" value={form.filing_year} onChange={e=>setForm({...form,filing_year:parseInt(e.target.value)||new Date().getFullYear()})} /></div>
            <div className="form-group"><label>状态</label><select className="form-control" value={form.filing_status} onChange={e=>setForm({...form,filing_status:e.target.value})}>{Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div className="form-group"><label>备注</label><textarea className="form-control" rows={2} value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})} /></div>

          {editing && (
            <div className="form-group">
              <label>备案证明图片</label>
              <div style={{border:'1px dashed var(--separator)',borderRadius:'8px',padding:'12px',background:'rgba(118,118,128,0.04)'}}>
                <button type="button" className="btn btn-sm" onClick={()=>handleUpload(editing.id)} disabled={uploading}><Upload size={13} /> {uploading?'上传中...':'上传证明'}</button>
                {evidences.length>0 && (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(100px, 1fr))',gap:'8px',marginTop:'12px'}}>
                    {evidences.map(ev=>(
                      <div key={ev.id} style={{position:'relative',borderRadius:'8px',overflow:'hidden',border:'1px solid var(--separator)',background:'#fff'}}>
                        <AuthImage
                          url={'/api/filings/'+editing.id+'/evidences/'+ev.id+'/file'}
                          style={{width:'100%',height:'80px',objectFit:'cover',cursor:'pointer'}}
                          onClick={async () => {
                            const u = await fetchBlobUrl('/api/filings/'+editing.id+'/evidences/'+ev.id+'/file');
                            window.open(u, '_blank');
                          }} />
                        <button type="button" onClick={()=>deleteEvidence(editing.id,ev.id)}
                          style={{position:'absolute',top:'3px',right:'3px',width:'20px',height:'20px',borderRadius:'50%',background:'rgba(255,59,48,0.85)',color:'#fff',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <X size={10} /></button>
                        <div style={{padding:'3px 6px',fontSize:'10px',color:'var(--text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.original_name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除备案"
        message="确定要删除该备案记录吗？此操作不可撤销。"
        confirmText="删除"
        danger
      />
    </PageShell>
  );
}
