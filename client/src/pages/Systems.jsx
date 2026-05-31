import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, ArrowLeft, Server } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete, hasPermission } from '../api';
import { PageShell, Toolbar, FilterSelect, EmptyState, Modal, DetailGrid } from '../components';

const STATUS_LABELS = { draft: '草稿', classified: '已定级', filed: '已备案', assessing: '测评中', rectifying: '整改中', completed: '已完成' };
const STATUS_CLASS = { draft: 'badge-gray', classified: 'badge-blue', filed: 'badge-blue', assessing: 'badge-yellow', rectifying: 'badge-yellow', completed: 'badge-green' };
const CAT_LABELS = { S1: 'S1-一般', S2: 'S2-重要', S3: 'S3-极重要', G1: 'G1-一般', G2: 'G2-重要', G3: 'G3-极重要' };

const emptyForm = { name: '', code: '', department: '', category: 'S2', description: '', security_level: 1, status: 'draft' };

export default function Systems() {
  const [systems, setSystems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [detail, setDetail] = useState(null);

  const loadSystems = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterStatus) params.set('status', filterStatus);
    apiGet('/api/systems?' + params).then(setSystems);
  };

  useEffect(loadSystems, [search, filterStatus]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (s) => { setEditing(s); setForm({ name:s.name, code:s.code, department:s.department, category:s.category, description:s.description, security_level:s.security_level, status:s.status }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    editing ? await apiPut('/api/systems/'+editing.id, form) : await apiPost('/api/systems', form);
    setShowModal(false); setEditing(null); loadSystems();
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除？')) return;
    await apiDelete('/api/systems/' + id);
    loadSystems();
  };

  if (detail) return <SystemDetail system={detail} onBack={() => { setDetail(null); loadSystems(); }} />;

  const statusOptions = Object.entries(STATUS_LABELS).map(([k,v]) => ({ value: k, label: v }));

  return (
    <PageShell
      title="信息系统"
      actions={hasPermission('system:create') && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> 新建系统</button>}
    >
      <Toolbar
        searchPlaceholder="搜索名称、编号或部门..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={<FilterSelect value={filterStatus} onChange={setFilterStatus} options={statusOptions} placeholder="全部状态" />}
      />

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>编号</th><th>名称</th><th>部门</th><th>等级</th><th>类别</th><th>状态</th><th>定级</th><th>整改</th><th style={{ width:'100px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {systems.length === 0 ? (
                <tr><td colSpan={9}><EmptyState icon={<Server size={32} />} title="暂无信息系统" description="点击右上角「新建系统」添加" /></td></tr>
              ) : systems.map(s => (
                <tr key={s.id}>
                  <td><code style={{ fontSize:'12px', color:'var(--text-secondary)' }}>{s.code || '-'}</code></td>
                  <td><strong style={{ cursor:'pointer' }} onClick={() => apiGet('/api/systems/'+s.id).then(setDetail)}>{s.name}</strong></td>
                  <td style={{ color:'var(--text-secondary)' }}>{s.department || '-'}</td>
                  <td>{s.security_level ? <span className={`level-badge level-${s.security_level}`}>{s.security_level}</span> : '-'}</td>
                  <td><span className="badge badge-gray">{CAT_LABELS[s.category] || s.category}</span></td>
                  <td><span className={`badge ${STATUS_CLASS[s.status]}`}>{STATUS_LABELS[s.status]}</span></td>
                  <td style={{ fontSize:'12px' }}>{s.classification ? `L${s.classification.business_impact_level}` : '—'}</td>
                  <td>{s.pendingRectifications > 0 ? <span className="badge badge-red">{s.pendingRectifications}项</span> : <span className="badge badge-green">无</span>}</td>
                  <td>
                    <div className="toolbar">
                      <button className="btn btn-sm" onClick={() => apiGet('/api/systems/'+s.id).then(setDetail)}><Eye size={13} /></button>
                      {hasPermission('system:edit') && <button className="btn btn-sm" onClick={() => openEdit(s)}><Edit2 size={13} /></button>}
                      {hasPermission('system:delete') && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? '编辑信息系统' : '新建信息系统'}
        width="560px"
        footer={
          <>
            <button className="btn" onClick={() => setShowModal(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? '保存' : '创建'}</button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label>系统名称 *</label><input className="form-control" required value={form.name} onChange={e => setForm({...form, name:e.target.value})} /></div>
            <div className="form-group"><label>系统编号 *</label><input className="form-control" required value={form.code} onChange={e => setForm({...form, code:e.target.value})} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>所属部门</label><input className="form-control" value={form.department} onChange={e => setForm({...form, department:e.target.value})} /></div>
            <div className="form-group"><label>业务类别</label><select className="form-control" value={form.category} onChange={e => setForm({...form, category:e.target.value})}>{['S1','S2','S3','G1','G2','G3'].map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>安全保护等级</label>
              <select className="form-control" value={form.security_level} onChange={e => setForm({...form, security_level:parseInt(e.target.value)})}>
                {[1,2,3,4,5].map(l => <option key={l} value={l}>第{l}级</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>状态</label>
              <select className="form-control" value={form.status} onChange={e => setForm({...form, status:e.target.value})}>
                {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label>系统描述</label><textarea className="form-control" value={form.description} onChange={e => setForm({...form, description:e.target.value})} rows={3} /></div>
        </form>
      </Modal>
    </PageShell>
  );
}

function SystemDetail({ system, onBack }) {
  const [tab, setTab] = useState('info');

  const tabs = [
    { key: 'info', label: '基本信息' },
    { key: 'classification', label: '定级信息' },
    { key: 'filing', label: '备案信息' },
    { key: 'gap', label: '差距分析' },
    { key: 'rectification', label: '整改任务' },
    { key: 'assessment', label: '测评记录' },
  ];

  return (
    <PageShell
      title={system.name}
      actions={<button className="btn" onClick={onBack}><ArrowLeft size={15} /> 返回列表</button>}
    >
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.key} className={`tab ${tab===t.key?'active':''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="card">
          <div className="card-body">
            <DetailGrid items={[
              { label: '系统编号', value: system.code },
              { label: '系统名称', value: system.name },
              { label: '所属部门', value: system.department },
              { label: '业务类别', value: CAT_LABELS[system.category] || system.category },
              { label: '安全等级', value: system.security_level ? `第${system.security_level}级` : null },
              { label: '状态', value: STATUS_LABELS[system.status] },
              { label: '描述', value: system.description },
              { label: '创建时间', value: system.created_at },
              { label: '更新时间', value: system.updated_at },
            ]} />
          </div>
        </div>
      )}

      {tab === 'classification' && (
        <div className="card">
          <div className="card-body">
            {system.classification ? (
              <DetailGrid items={[
                { label: '业务影响等级', value: `L${system.classification.business_impact_level}` },
                { label: '服务范围', value: system.classification.service_scope },
                { label: '业务依赖', value: system.classification.business_dependency },
                { label: '定级人', value: system.classification.classified_by },
                { label: '定级日期', value: system.classification.classified_at },
              ]} />
            ) : <EmptyState title="暂无定级信息" description="请在系统定级中为该信息系统创建定级记录" />}
          </div>
        </div>
      )}

      {tab === 'filing' && (
        <div className="card">
          <div className="card-body">
            {system.filing ? (
              <DetailGrid items={[
                { label: '备案编号', value: system.filing.filing_number },
                { label: '备案机关', value: system.filing.filing_authority },
                { label: '备案日期', value: system.filing.filing_date },
                { label: '审批日期', value: system.filing.approval_date },
                { label: '状态', value: system.filing.filing_status },
              ]} />
            ) : <EmptyState title="暂无备案信息" />}
          </div>
        </div>
      )}

      {tab === 'gap' && (
        <div className="card">
          <div className="card-body">
            {system.gapAnalyses?.length > 0 ? (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>分析日期</th><th>得分</th><th>合规率</th></tr></thead>
                  <tbody>
                    {system.gapAnalyses.map(g => (
                      <tr key={g.id}><td>{g.analysis_date}</td><td>{g.overall_score}</td><td>{g.compliance_rate}%</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="暂无差距分析" />}
          </div>
        </div>
      )}

      {tab === 'rectification' && (
        <div className="card">
          <div className="card-body">
            {system.rectifications?.length > 0 ? (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>标题</th><th>负责人</th><th>优先级</th><th>状态</th><th>计划完成</th></tr></thead>
                  <tbody>
                    {system.rectifications.map(r => (
                      <tr key={r.id}><td>{r.title}</td><td>{r.responsible_person||'-'}</td><td>{r.priority}</td><td>{r.status}</td><td>{r.plan_end_date||'-'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="暂无整改任务" />}
          </div>
        </div>
      )}

      {tab === 'assessment' && (
        <div className="card">
          <div className="card-body">
            {system.assessments?.length > 0 ? (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>测评机构</th><th>类型</th><th>日期</th><th>得分</th><th>结论</th></tr></thead>
                  <tbody>
                    {system.assessments.map(a => (
                      <tr key={a.id}><td>{a.assessment_agency}</td><td>{a.assessment_type}</td><td>{a.assessment_date}</td><td>{a.overall_score}</td><td>{a.conclusion}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="暂无测评记录" />}
          </div>
        </div>
      )}
    </PageShell>
  );
}
