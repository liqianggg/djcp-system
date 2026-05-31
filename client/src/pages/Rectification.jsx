import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Upload, X, CheckCircle, Play, RotateCcw } from 'lucide-react';
import { apiGet, apiUpload, hasPermission } from '../api';
import { PageShell, Toolbar, FilterSelect, EmptyState, Modal } from '../components';

const PRIORITY = { urgent: '紧急', high: '高', medium: '中', low: '低' };
const PRIORITY_CLASS = { urgent: 'badge-red', high: 'badge-yellow', medium: 'badge-blue', low: 'badge-gray' };
const STATUS = { pending: '待处理', in_progress: '进行中', completed: '已完成', verified: '已验证' };
const STATUS_CLASS = { pending: 'badge-gray', in_progress: 'badge-blue', completed: 'badge-green', verified: 'badge-green' };

const emptyForm = { system_id:'', gap_item_id:'', title:'', description:'', responsible_person:'', priority:'medium', plan_start_date:'', plan_end_date:'', cost:0, remarks:'' };

export default function Rectification() {
  const [systems, setSystems] = useState([]);
  const [rectifications, setRectifications] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState('');
  const [evidences, setEvidences] = useState([]);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    const p = new URLSearchParams();
    if (filterStatus) p.set('status', filterStatus);
    apiGet('/api/rectifications?' + p).then(setRectifications);
  };

  useEffect(() => {
    apiGet('/api/systems').then(setSystems);
    load();
  }, [filterStatus]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setEvidences([]); setShowModal(true); };

  const openEdit = (r) => {
    setEditing(r);
    setForm({ system_id:r.system_id, gap_item_id:r.gap_item_id||'', title:r.title, description:r.description||'', responsible_person:r.responsible_person||'', priority:r.priority, plan_start_date:r.plan_start_date||'', plan_end_date:r.plan_end_date||'', cost:r.cost||0, remarks:r.remarks||'' });
    apiGet('/api/rectifications/'+r.id+'/evidences').then(setEvidences);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editing ? '/api/rectifications/'+editing.id : '/api/rectifications';
    await fetch(url, {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${localStorage.getItem('djcp_token')}` },
      body: JSON.stringify(editing ? { ...form, status:form.status||editing.status } : form)
    });
    setShowModal(false); setEditing(null); load();
  };

  const changeStatus = async (r, newStatus) => {
    await fetch('/api/rectifications/'+r.id, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${localStorage.getItem('djcp_token')}` },
      body: JSON.stringify({
        title:r.title, description:r.description, responsible_person:r.responsible_person,
        priority:r.priority, status:newStatus, plan_start_date:r.plan_start_date, plan_end_date:r.plan_end_date,
        actual_start_date:newStatus==='in_progress'&&!r.actual_start_date?new Date().toISOString().split('T')[0]:r.actual_start_date,
        actual_end_date:newStatus==='completed'?new Date().toISOString().split('T')[0]:r.actual_end_date,
        cost:r.cost, evidence:r.evidence, remarks:r.remarks
      })
    });
    load();
  };

  const handleUpload = async (rectId) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
    input.onchange = async (e) => {
      if (!e.target.files.length) return;
      setUploading(true);
      for (const f of e.target.files) {
        const fd = new FormData(); fd.append('file', f);
        await apiUpload('/api/rectifications/'+rectId+'/evidences', fd);
      }
      setUploading(false);
      apiGet('/api/rectifications/'+rectId+'/evidences').then(setEvidences);
    };
    input.click();
  };

  const deleteEvidence = async (rectId, evId) => {
    if (!confirm('删除该截图？')) return;
    await fetch('/api/rectifications/'+rectId+'/evidences/'+evId, {
      method: 'DELETE', headers: { 'Authorization':`Bearer ${localStorage.getItem('djcp_token')}` }
    });
    apiGet('/api/rectifications/'+rectId+'/evidences').then(setEvidences);
  };

  const statusOpts = Object.entries(STATUS).map(([k,v]) => ({value:k, label:v}));

  return (
    <PageShell
      title="整改管理"
      actions={hasPermission('rectification:create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> 新建任务</button>}
    >
      <Toolbar
        searchPlaceholder="搜索整改标题..."
        filters={<FilterSelect value={filterStatus} onChange={setFilterStatus} options={statusOpts} placeholder="全部状态" />}
      />

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>标题</th><th>负责人</th><th>信息系统</th><th>优先级</th><th>状态</th><th>计划完成</th><th style={{width:'160px'}}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rectifications.length === 0 ? (
                <tr><td colSpan={7}><EmptyState title="暂无整改任务" /></td></tr>
              ) : rectifications.map(r => (
                <tr key={r.id}>
                  <td><strong style={{cursor:'pointer'}} onClick={() => openEdit(r)}>{r.title}</strong></td>
                  <td style={{color:'var(--text-secondary)'}}>{r.responsible_person||'-'}</td>
                  <td style={{fontSize:'12px',color:'var(--text-secondary)'}}>{r.system_name||'-'}</td>
                  <td><span className={`badge ${PRIORITY_CLASS[r.priority]}`}>{PRIORITY[r.priority]}</span></td>
                  <td><span className={`badge ${STATUS_CLASS[r.status]}`}>{STATUS[r.status]}</span></td>
                  <td style={{fontSize:'12px',color:'var(--text-secondary)'}}>{r.plan_end_date||'-'}</td>
                  <td>
                    <div className="toolbar">
                      {r.status==='pending' && (
                        <button className="btn btn-sm" onClick={() => changeStatus(r,'in_progress')} title="开始处理"><Play size={12} /></button>
                      )}
                      {r.status==='in_progress' && (
                        <button className="btn btn-sm btn-success" onClick={() => changeStatus(r,'completed')} title="标记完成"><CheckCircle size={12} /></button>
                      )}
                      {r.status==='completed' && (
                        <button className="btn btn-sm" onClick={() => changeStatus(r,'in_progress')} title="重新打开"><RotateCcw size={12} /></button>
                      )}
                      <button className="btn btn-sm" onClick={() => openEdit(r)}><Edit2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={showModal} onClose={() => setShowModal(false)}
        title={editing ? '编辑整改任务' : '新建整改任务'}
        width="600px"
        footer={<><button className="btn" onClick={() => setShowModal(false)}>取消</button><button className="btn btn-primary" onClick={handleSubmit}>{editing?'保存':'创建'}</button></>}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>任务标题 *</label><input className="form-control" required value={form.title} onChange={e => setForm({...form, title:e.target.value})} /></div>

          {!editing && (
            <div className="form-row">
              <div className="form-group"><label>关联系统</label><select className="form-control" value={form.system_id} onChange={e => setForm({...form, system_id:e.target.value})}><option value="">请选择</option>{systems.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="form-group"><label>负责人</label><input className="form-control" value={form.responsible_person} onChange={e => setForm({...form, responsible_person:e.target.value})} /></div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>优先级</label>
              <select className="form-control" value={form.priority} onChange={e => setForm({...form, priority:e.target.value})}>
                {Object.entries(PRIORITY).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {editing && (
              <div className="form-group">
                <label>状态</label>
                <select className="form-control" value={form.status||editing.status} onChange={e => setForm({...form, status:e.target.value})}>
                  {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group"><label>计划开始</label><input className="form-control" type="date" value={form.plan_start_date} onChange={e => setForm({...form, plan_start_date:e.target.value})} /></div>
            <div className="form-group"><label>计划完成</label><input className="form-control" type="date" value={form.plan_end_date} onChange={e => setForm({...form, plan_end_date:e.target.value})} /></div>
          </div>

          <div className="form-group"><label>任务描述</label><textarea className="form-control" rows={3} value={form.description} onChange={e => setForm({...form, description:e.target.value})} /></div>

          <div className="form-row">
            <div className="form-group"><label>预估费用 (元)</label><input className="form-control" type="number" value={form.cost} onChange={e => setForm({...form, cost:parseFloat(e.target.value)||0})} /></div>
            <div className="form-group"><label>备注</label><input className="form-control" value={form.remarks} onChange={e => setForm({...form, remarks:e.target.value})} /></div>
          </div>

          {/* 整改截图 — 仅编辑时显示 */}
          {editing && (
            <div className="form-group">
              <label>整改截图</label>
              <div style={{ border:'1px dashed var(--separator)', borderRadius:'8px', padding:'12px', background:'rgba(118,118,128,0.04)' }}>
                <button type="button" className="btn btn-sm" onClick={() => handleUpload(editing.id)} disabled={uploading}>
                  <Upload size={13} /> {uploading ? '上传中...' : '上传截图'}
                </button>
                {evidences.length > 0 && (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(100px, 1fr))', gap:'8px', marginTop:'12px' }}>
                    {evidences.map(ev => (
                      <div key={ev.id} style={{ position:'relative', borderRadius:'8px', overflow:'hidden', border:'1px solid var(--separator)', background:'#fff' }}>
                        <img
                          src={'/api/rectifications/'+editing.id+'/evidences/'+ev.id+'/file?token='+localStorage.getItem('djcp_token')}
                          alt={ev.original_name}
                          style={{ width:'100%', height:'80px', objectFit:'cover', cursor:'pointer' }}
                          onClick={() => window.open('/api/rectifications/'+editing.id+'/evidences/'+ev.id+'/file?token='+localStorage.getItem('djcp_token'), '_blank')}
                        />
                        <button type="button" onClick={() => deleteEvidence(editing.id, ev.id)}
                          style={{ position:'absolute', top:'3px', right:'3px', width:'20px', height:'20px', borderRadius:'50%', background:'rgba(255,59,48,0.85)', color:'#fff', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                        ><X size={10} /></button>
                        <div style={{ padding:'3px 6px', fontSize:'10px', color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {ev.original_name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </form>
      </Modal>
    </PageShell>
  );
}
