import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, Calendar, Users, Phone, Search, UserPlus } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete, hasPermission } from '../api';
import { PageShell, Toolbar, EmptyState, Modal } from '../components';

const emptyAgency = {
  name: '', qualification_level: '', qualification_number: '', qualification_expiry: '',
  address: '', phone: '', email: '', contact_person: '', contact_phone: '', contact_email: '', remarks: ''
};

const emptyRecord = {
  assessment_id: '', entry_date: '', exit_date: '', assessment_personnel: '', client_contact_id: '', remarks: ''
};

const QUAL_LEVELS = ['国家级', '省级', '市级', '其他'];
const STATUS_LABELS = { active: '活跃', inactive: '停用' };
const STATUS_CLASS = { active: 'badge-green', inactive: 'badge-gray' };

export default function AgencyManagement() {
  const [agencies, setAgencies] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingAgency, setEditingAgency] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form, setForm] = useState(emptyAgency);
  const [recordForm, setRecordForm] = useState(emptyRecord);
  const [users, setUsers] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [agencyRecords, setAgencyRecords] = useState([]);
  const [activeAgencyId, setActiveAgencyId] = useState(null);
  const [search, setSearch] = useState('');

  const loadAgencies = () => {
    apiGet('/api/agencies').then(setAgencies);
  };

  useEffect(() => {
    loadAgencies();
    apiGet('/api/users/active').then(setUsers);
    apiGet('/api/assessments').then(setAssessments);
  }, []);

  const toggleExpand = (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setActiveAgencyId(id);
    apiGet('/api/agencies/' + id + '/records').then(setAgencyRecords);
  };

  // Agency CRUD
  const openCreateAgency = () => {
    setEditingAgency(null);
    setForm(emptyAgency);
    setShowAgencyModal(true);
  };

  const openEditAgency = (a) => {
    setEditingAgency(a);
    setForm({
      name: a.name, qualification_level: a.qualification_level || '', qualification_number: a.qualification_number || '',
      qualification_expiry: a.qualification_expiry || '', address: a.address || '', phone: a.phone || '',
      email: a.email || '', contact_person: a.contact_person || '', contact_phone: a.contact_phone || '',
      contact_email: a.contact_email || '', remarks: a.remarks || ''
    });
    setShowAgencyModal(true);
  };

  const saveAgency = async (e) => {
    e.preventDefault();
    try {
      if (editingAgency) {
        await apiPut('/api/agencies/' + editingAgency.id, form);
      } else {
        await apiPost('/api/agencies', form);
      }
      setShowAgencyModal(false);
      loadAgencies();
    } catch (err) {
      alert('保存失败: ' + (err.message || '未知错误'));
    }
  };

  const deleteAgency = async (id) => {
    if (!confirm('确定删除该测评机构及其所有进场记录？')) return;
    try {
      await apiDelete('/api/agencies/' + id);
      loadAgencies();
    } catch (err) {
      alert('删除失败: ' + (err.message || '未知错误'));
    }
  };

  // On-site record CRUD
  const openCreateRecord = () => {
    setEditingRecord(null);
    setRecordForm(emptyRecord);
    setShowRecordModal(true);
  };

  const openEditRecord = (r) => {
    setEditingRecord(r);
    setRecordForm({
      assessment_id: r.assessment_id || '', entry_date: r.entry_date || '', exit_date: r.exit_date || '',
      assessment_personnel: r.assessment_personnel || '', client_contact_id: r.client_contact_id || '', remarks: r.remarks || ''
    });
    setShowRecordModal(true);
  };

  const saveRecord = async (e) => {
    e.preventDefault();
    try {
      const base = '/api/agencies/' + activeAgencyId + '/records';
      if (editingRecord) {
        await apiPut(base + '/' + editingRecord.id, recordForm);
      } else {
        await apiPost(base, recordForm);
      }
      setShowRecordModal(false);
      apiGet('/api/agencies/' + activeAgencyId + '/records').then(setAgencyRecords);
    } catch (err) {
      alert('保存失败: ' + (err.message || '未知错误'));
    }
  };

  const deleteRecord = async (rid) => {
    if (!confirm('确定删除该进场记录？')) return;
    try {
      await apiDelete('/api/agencies/' + activeAgencyId + '/records/' + rid);
      apiGet('/api/agencies/' + activeAgencyId + '/records').then(setAgencyRecords);
    } catch (err) {
      alert('删除失败: ' + (err.message || '未知错误'));
    }
  };

  const filtered = agencies.filter(a =>
    !search || a.name.includes(search) || (a.contact_person || '').includes(search)
  );

  return (
    <PageShell title="测评机构管理">
      <Toolbar
        searchPlaceholder="搜索机构名称或对接人..."
        searchValue={search}
        onSearchChange={setSearch}
        actions={hasPermission('agency:create') && (
          <button className="btn btn-primary" onClick={openCreateAgency}>
            <Plus size={15} /> 新增机构
          </button>
        )}
      />

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: '28px' }}></th>
                <th>机构名称</th>
                <th>资质等级</th>
                <th>对接人</th>
                <th>联系电话</th>
                <th>状态</th>
                <th style={{ width: '120px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={<Building2 size={32} />} title="暂无测评机构" description="点击右上角「新增机构」添加" />
                  </td>
                </tr>
              ) : (
                filtered.map(a => (
                  <React.Fragment key={a.id}>
                    <tr
                      onClick={() => toggleExpand(a.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        {expanded === a.id ? '▾' : '▸'}
                      </td>
                      <td><strong>{a.name}</strong></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{a.qualification_level || '-'}</td>
                      <td>{a.contact_person || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{a.phone || a.contact_phone || '-'}</td>
                      <td><span className={`badge ${STATUS_CLASS[a.status] || 'badge-gray'}`}>{STATUS_LABELS[a.status] || a.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {hasPermission('agency:edit') && (
                            <button className="btn btn-sm" onClick={e => { e.stopPropagation(); openEditAgency(a); }}>
                              <Edit2 size={13} />
                            </button>
                          )}
                          {hasPermission('agency:delete') && (
                            <button className="btn btn-sm" onClick={e => { e.stopPropagation(); deleteAgency(a.id); }}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === a.id && (
                      <tr>
                        <td colSpan={7} style={{ padding: '0', borderBottom: '1px solid var(--separator)' }}>
                          <div style={{
                            padding: '12px 20px', background: 'rgba(118,118,128,0.04)',
                            display: 'flex', flexDirection: 'column', gap: '10px'
                          }}>
                            {/* Agency detail info */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {a.qualification_number && <span><strong>资质编号:</strong> {a.qualification_number}</span>}
                              {a.qualification_expiry && <span><strong>有效期:</strong> {a.qualification_expiry}</span>}
                              {a.address && <span><strong>地址:</strong> {a.address}</span>}
                              {a.email && <span><strong>邮箱:</strong> {a.email}</span>}
                              {a.contact_email && <span><strong>对接人邮箱:</strong> {a.contact_email}</span>}
                              {a.remarks && <span><strong>备注:</strong> {a.remarks}</span>}
                            </div>

                            {/* Records section */}
                            <div style={{ borderTop: '1px solid var(--separator)', paddingTop: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                                  <Calendar size={13} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
                                  进场记录
                                </span>
                                {hasPermission('onsite:create') && (
                                  <button className="btn btn-sm btn-primary" onClick={openCreateRecord}>
                                    <Plus size={12} /> 新增记录
                                  </button>
                                )}
                              </div>
                              {agencyRecords.length === 0 ? (
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', padding: '8px 0' }}>暂无进场记录</div>
                              ) : (
                                <div className="table-wrapper" style={{ maxHeight: '300px' }}>
                                  <table style={{ fontSize: '12px' }}>
                                    <thead>
                                      <tr>
                                        <th>进场日期</th>
                                        <th>离场日期</th>
                                        <th>关联项目</th>
                                        <th>测评人员</th>
                                        <th>甲方对接</th>
                                        <th>备注</th>
                                        <th style={{ width: '60px' }}>操作</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {agencyRecords.map(r => (
                                        <tr key={r.id}>
                                          <td>{r.entry_date || '-'}</td>
                                          <td>{r.exit_date || '-'}</td>
                                          <td style={{ color: 'var(--text-secondary)' }}>{r.system_name ? `${r.system_name} (${r.system_id})` : '-'}</td>
                                          <td>{r.assessment_personnel || '-'}</td>
                                          <td>
                                            {r.client_contact_name ? (
                                              <span style={{ padding: '1px 6px', borderRadius: '4px', background: 'rgba(0,122,255,0.08)', color: '#007AFF', fontSize: '11px' }}>
                                                {r.client_contact_name}
                                              </span>
                                            ) : '-'}
                                          </td>
                                          <td style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.remarks || '-'}</td>
                                          <td>
                                            <div style={{ display: 'flex', gap: '2px' }}>
                                              {hasPermission('onsite:edit') && (
                                                <button className="btn btn-sm" onClick={() => openEditRecord(r)}>
                                                  <Edit2 size={11} />
                                                </button>
                                              )}
                                              {hasPermission('onsite:delete') && (
                                                <button className="btn btn-sm" onClick={() => deleteRecord(r.id)}>
                                                  <Trash2 size={11} />
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agency Modal */}
      <Modal
        open={showAgencyModal}
        onClose={() => setShowAgencyModal(false)}
        title={editingAgency ? '编辑测评机构' : '新增测评机构'}
        width="560px"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setShowAgencyModal(false)}>取消</button>
            <button type="submit" className="btn btn-primary" form="agency-form">保存</button>
          </>
        }
      >
        <form id="agency-form" onSubmit={saveAgency}>
          <div className="form-row">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>机构名称 *</label>
              <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>资质等级</label>
              <select className="form-control" value={form.qualification_level} onChange={e => setForm({ ...form, qualification_level: e.target.value })}>
                <option value="">请选择</option>
                {QUAL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>资质编号</label>
              <input className="form-control" value={form.qualification_number} onChange={e => setForm({ ...form, qualification_number: e.target.value })} />
            </div>
            <div className="form-group">
              <label>资质有效期</label>
              <input type="date" className="form-control" value={form.qualification_expiry} onChange={e => setForm({ ...form, qualification_expiry: e.target.value })} />
            </div>
            <div className="form-group">
              <label>联系电话</label>
              <input className="form-control" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label>机构邮箱</label>
              <input type="email" className="form-control" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>地址</label>
              <input className="form-control" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--separator)', paddingTop: '14px', marginTop: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={14} /> 机构对接人信息
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>对接人姓名</label>
                <input className="form-control" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} />
              </div>
              <div className="form-group">
                <label>对接人电话</label>
                <input className="form-control" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>对接人邮箱</label>
                <input type="email" className="form-control" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>备注</label>
            <textarea className="form-control" rows={2} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
          </div>
        </form>
      </Modal>

      {/* On-site Record Modal */}
      <Modal
        open={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        title={editingRecord ? '编辑进场记录' : '新增进场记录'}
        width="540px"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setShowRecordModal(false)}>取消</button>
            <button type="submit" className="btn btn-primary" form="record-form">保存</button>
          </>
        }
      >
        <form id="record-form" onSubmit={saveRecord}>
          <div className="form-row">
            <div className="form-group">
              <label>关联测评项目</label>
              <select className="form-control" value={recordForm.assessment_id} onChange={e => setRecordForm({ ...recordForm, assessment_id: e.target.value })}>
                <option value="">不关联</option>
                {assessments.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.system_name} — {a.assessment_type} ({a.assessment_date})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>进场日期 *</label>
              <input type="date" className="form-control" value={recordForm.entry_date} onChange={e => setRecordForm({ ...recordForm, entry_date: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>离场日期</label>
              <input type="date" className="form-control" value={recordForm.exit_date} onChange={e => setRecordForm({ ...recordForm, exit_date: e.target.value })} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>测评人员</label>
              <input className="form-control" placeholder="多个人员用逗号分隔" value={recordForm.assessment_personnel} onChange={e => setRecordForm({ ...recordForm, assessment_personnel: e.target.value })} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>甲方对接人员</label>
              <select className="form-control" value={recordForm.client_contact_id} onChange={e => setRecordForm({ ...recordForm, client_contact_id: e.target.value })}>
                <option value="">请选择系统用户</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.real_name} ({u.username}){u.department ? ' — ' + u.department : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>备注</label>
              <textarea className="form-control" rows={2} value={recordForm.remarks} onChange={e => setRecordForm({ ...recordForm, remarks: e.target.value })} />
            </div>
          </div>
        </form>
      </Modal>
    </PageShell>
  );
}
