import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Eye } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete, hasPermission } from '../api';

const STATUS_LABELS = { draft: '草稿', classified: '已定级', filed: '已备案', assessing: '测评中', rectifying: '整改中', completed: '已完成' };
const STATUS_COLORS = { draft: 'badge-gray', classified: 'badge-blue', filed: 'badge-blue', assessing: 'badge-yellow', rectifying: 'badge-yellow', completed: 'badge-green' };
const CATEGORY_LABELS = { S1: 'S1-一般', S2: 'S2-重要', S3: 'S3-极重要', G1: 'G1-一般', G2: 'G2-重要', G3: 'G3-极重要' };

const emptySystem = { name: '', code: '', department: '', category: 'S2', description: '', security_level: 1, status: 'draft' };

export default function Systems() {
  const [systems, setSystems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptySystem);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);

  const loadSystems = async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const data = await apiGet('/api/systems?' + params);
    if (data) setSystems(data);
  };

  useEffect(() => { loadSystems(); }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) await apiPut('/api/systems/' + editing.id, form);
    else await apiPost('/api/systems', form);
    setShowModal(false); setEditing(null); setForm(emptySystem);
    loadSystems();
  };

  const handleEdit = (sys) => {
    setEditing(sys);
    setForm({ name: sys.name, code: sys.code, department: sys.department, category: sys.category, description: sys.description, security_level: sys.security_level, status: sys.status });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除该信息系统吗？')) return;
    await apiDelete('/api/systems/' + id);
    loadSystems();
  };

  const handleView = async (id) => {
    const data = await apiGet('/api/systems/' + id);
    if (data) setDetail(data);
  };

  if (detail) return <SystemDetail system={detail} onBack={() => { setDetail(null); loadSystems(); }} />;

  return (
    <div>
      <div className="page-header">
        <h2>🖥️ 信息系统管理</h2>
        {hasPermission('system:create') && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptySystem); setShowModal(true); }}>
            <Plus size={16} /> 新建系统
          </button>
        )}
      </div>

      <div className="page-body">
        <div className="search-bar">
          <Search size={16} style={{ color: 'var(--text-secondary)' }} />
          <input className="form-control" placeholder="搜索系统名称、编号或部门..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>编号</th><th>名称</th><th>部门</th><th>等级</th><th>类别</th><th>状态</th><th>定级信息</th><th>待整改</th><th>操作</th></tr></thead>
              <tbody>
                {systems.length === 0 ? (
                  <tr><td colSpan="9" className="empty-state"><h3>暂无信息系统</h3></td></tr>
                ) : systems.map(sys => (
                  <tr key={sys.id}>
                    <td><code>{sys.code || '-'}</code></td><td><strong>{sys.name}</strong></td><td>{sys.department || '-'}</td>
                    <td>{sys.security_level ? <span className={`level-badge level-${sys.security_level}`}>{sys.security_level}</span> : '-'}</td>
                    <td><span className="badge badge-gray">{CATEGORY_LABELS[sys.category]}</span></td>
                    <td><span className={`badge ${STATUS_COLORS[sys.status]}`}>{STATUS_LABELS[sys.status]}</span></td>
                    <td style={{ fontSize: '12px' }}>{sys.classification ? `L${sys.classification.business_impact_level}` : '未定级'}</td>
                    <td>{sys.pendingRectifications > 0 ? <span className="badge badge-red">{sys.pendingRectifications}项</span> : <span className="badge badge-green">无</span>}</td>
                    <td>
                      <div className="toolbar">
                        <button className="btn btn-sm" onClick={() => handleView(sys.id)} title="查看"><Eye size={14} /></button>
                        {hasPermission('system:edit') && <button className="btn btn-sm" onClick={() => handleEdit(sys)} title="编辑"><Edit2 size={14} /></button>}
                        {hasPermission('system:delete') && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(sys.id)} title="删除"><Trash2 size={14} /></button>}
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
            <div className="modal-header">{editing ? '编辑信息系统' : '新建信息系统'}<button className="btn btn-sm" onClick={() => setShowModal(false)}>✕</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label>系统名称 *</label><input className="form-control" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                  <div className="form-group"><label>系统编号</label><input className="form-control" value={form.code} onChange={e => setForm({...form, code: e.target.value})} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>所属部门</label><input className="form-control" value={form.department} onChange={e => setForm({...form, department: e.target.value})} /></div>
                  <div className="form-group">
                    <label>业务类别</label>
                    <select className="form-control" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                      <option value="S1">S1-一般</option><option value="S2">S2-重要</option><option value="S3">S3-极重要</option>
                      <option value="G1">G1-一般</option><option value="G2">G2-重要</option><option value="G3">G3-极重要</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>安全保护等级</label><select className="form-control" value={form.security_level} onChange={e => setForm({...form, security_level: parseInt(e.target.value)})}>{[1,2,3,4,5].map(l => <option key={l} value={l}>第{l}级</option>)}</select></div>
                  <div className="form-group"><label>状态</label><select className="form-control" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>{Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                </div>
                <div className="form-group"><label>系统描述</label><textarea className="form-control" value={form.description} onChange={e => setForm({...form, description: e.target.value})}></textarea></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn" onClick={() => setShowModal(false)}>取消</button><button type="submit" className="btn btn-primary">{editing ? '保存' : '创建'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SystemDetail({ system, onBack }) {
  const [tab, setTab] = useState('info');
  return (
    <div>
      <div className="page-header"><h2>📋 {system.name}</h2><button className="btn" onClick={onBack}>← 返回</button></div>
      <div className="page-body">
        <div className="tabs">
          {['info','classification','filing','gap','rectification','assessment'].map(t => (
            <button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
              {{info:'基本信息',classification:'定级信息',filing:'备案信息',gap:'差距分析',rectification:'整改任务',assessment:'测评记录'}[t]}
            </button>
          ))}
        </div>
        {tab==='info' && <div className="card"><div className="card-body"><div className="detail-grid">
          {[['系统编号',system.code],['系统名称',system.name],['所属部门',system.department],['业务类别',CATEGORY_LABELS[system.category]],['安全等级',system.security_level],['状态',STATUS_LABELS[system.status]],['描述',system.description],['创建时间',system.created_at],['更新时间',system.updated_at]].map(([k,v],i) => <div key={i} className="detail-item"><span className="label">{k}:</span><span className="value">{v||'-'}</span></div>)}
        </div></div></div>}
        {tab==='classification' && <DetailBlock label="定级" data={system.classification} fields={[['业务影响等级',`L${system.classification?.business_impact_level}`],['服务范围',system.classification?.service_scope],['业务依赖',system.classification?.business_dependency],['定级人',system.classification?.classified_by],['定级日期',system.classification?.classified_at]]} />}
        {tab==='filing' && <DetailBlock label="备案" data={system.filing} fields={[['备案编号',system.filing?.filing_number],['备案机关',system.filing?.filing_authority],['备案日期',system.filing?.filing_date],['审批日期',system.filing?.approval_date],['状态',system.filing?.filing_status]]} />}
        {tab==='gap' && (system.gapAnalyses?.length > 0 ? system.gapAnalyses.map(g => <div key={g.id} className="card"><div className="card-body">{['分析日期',g.analysis_date,'得分',g.overall_score,'合规率',g.compliance_rate+'%'].map((v,i)=>i%2===0?<span key={i} className="label">{v}: </span>:<span key={i}>{v} </span>)}</div></div>) : <EmptyBlock label="差距分析" />)}
        {tab==='rectification' && (system.rectifications?.length > 0 ? <div className="table-wrapper"><table><thead><tr><th>标题</th><th>负责人</th><th>优先级</th><th>状态</th><th>完成</th></tr></thead><tbody>{system.rectifications.map(r=><tr key={r.id}><td>{r.title}</td><td>{r.responsible_person||'-'}</td><td>{r.priority}</td><td>{r.status}</td><td>{r.plan_end_date||'-'}</td></tr>)}</tbody></table></div> : <EmptyBlock label="整改任务" />)}
        {tab==='assessment' && (system.assessments?.length > 0 ? system.assessments.map(a=><div key={a.id} className="card"><div className="card-body">{['机构',a.assessment_agency,'类型',a.assessment_type,'日期',a.assessment_date,'得分',a.overall_score,'结论',a.conclusion].map((v,i)=>i%2===0?<span key={i} className="label">{v}: </span>:<span key={i}>{v} </span>)}</div></div>) : <EmptyBlock label="测评记录" />)}
      </div>
    </div>
  );
}

function DetailBlock({ label, data, fields }) {
  if (!data) return <EmptyBlock label={label} />;
  return <div className="card"><div className="card-body"><div className="detail-grid">{fields.map(([k,v],i)=><div key={i} className="detail-item"><span className="label">{k}:</span><span className="value">{v||'-'}</span></div>)}</div></div></div>;
}

function EmptyBlock({ label }) {
  return <div className="card"><div className="card-body empty-state"><h3>暂无{label}数据</h3></div></div>;
}
