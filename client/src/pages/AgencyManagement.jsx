import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, Calendar, Users, Phone, Mail, MapPin, ChevronDown, ChevronUp, UserPlus, X } from 'lucide-react';
import { apiGet, hasPermission } from '../api';
import { PageShell, EmptyState, Modal } from '../components';

const API = '';

const emptyAgency = {
  name: '', qualification_level: '', qualification_number: '', qualification_expiry: '',
  address: '', phone: '', email: '', contact_person: '', contact_phone: '', contact_email: '', remarks: ''
};

const emptyRecord = {
  assessment_id: '', entry_date: '', exit_date: '', assessment_personnel: '', client_contact_id: '', remarks: ''
};

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

  const toggleExpand = async (id) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
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
    const url = editingAgency ? '/api/agencies/' + editingAgency.id : '/api/agencies';
    await fetch(API + url, {
      method: editingAgency ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('djcp_token')}` },
      body: JSON.stringify(form)
    });
    setShowAgencyModal(false);
    loadAgencies();
  };

  const deleteAgency = async (id) => {
    if (!confirm('确定删除该测评机构及其所有进场记录？')) return;
    await fetch(API + '/api/agencies/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('djcp_token')}` }
    });
    loadAgencies();
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
    const base = '/api/agencies/' + activeAgencyId + '/records';
    const url = editingRecord ? base + '/' + editingRecord.id : base;
    await fetch(API + url, {
      method: editingRecord ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('djcp_token')}` },
      body: JSON.stringify(recordForm)
    });
    setShowRecordModal(false);
    apiGet('/api/agencies/' + activeAgencyId + '/records').then(setAgencyRecords);
  };

  const deleteRecord = async (rid) => {
    if (!confirm('确定删除该进场记录？')) return;
    await fetch(API + '/api/agencies/' + activeAgencyId + '/records/' + rid, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('djcp_token')}` }
    });
    apiGet('/api/agencies/' + activeAgencyId + '/records').then(setAgencyRecords);
  };

  const filtered = agencies.filter(a =>
    !search || a.name.includes(search) || (a.contact_person || '').includes(search)
  );

  const STATUS = { active: '活跃', inactive: '停用' };

  return (
    <div>
      <PageShell title="测评机构管理" actions={
        hasPermission('agency:create') && (
          <button className="btn-primary" onClick={openCreateAgency} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} />新增机构
          </button>
        )
      }>
        {/* Search */}
        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="搜索机构名称或对接人..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', maxWidth: '360px', padding: '8px 14px', borderRadius: '10px',
              border: '1px solid rgba(60,60,67,0.12)', fontSize: '13px', outline: 'none',
              background: 'var(--bg-tertiary)',
            }}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Building2 size={48} color="var(--text-tertiary)" />} title="暂无测评机构" description="点击"新增机构"添加第一个测评机构" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(a => (
              <div key={a.id} style={{
                background: 'var(--bg-tertiary)', borderRadius: '14px',
                border: '1px solid rgba(60,60,67,0.08)', overflow: 'hidden',
              }}>
                {/* Agency card header */}
                <div
                  onClick={() => toggleExpand(a.id)}
                  style={{
                    padding: '14px 18px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      background: 'rgba(0,122,255,0.1)', color: '#007AFF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '18px',
                    }}>
                      <Building2 size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 600 }}>{a.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {a.qualification_level && <span>资质: {a.qualification_level}</span>}
                        {a.contact_person && <span>对接人: {a.contact_person}</span>}
                        {a.phone && <span><Phone size={10} style={{ verticalAlign: 'middle', marginRight: '2px' }} />{a.phone}</span>}
                        <span className={`badge ${a.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{STATUS[a.status]}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {hasPermission('agency:edit') && (
                      <button onClick={e => { e.stopPropagation(); openEditAgency(a); }} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px',
                        color: 'var(--text-secondary)',
                      }}><Edit2 size={15} /></button>
                    )}
                    {hasPermission('agency:delete') && (
                      <button onClick={e => { e.stopPropagation(); deleteAgency(a.id); }} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px',
                        color: 'var(--text-secondary)',
                      }}><Trash2 size={15} /></button>
                    )}
                    {expanded === a.id ? <ChevronUp size={18} color="var(--text-tertiary)" /> : <ChevronDown size={18} color="var(--text-tertiary)" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded === a.id && (
                  <div style={{ padding: '0 18px 18px', borderTop: '1px solid rgba(60,60,67,0.06)' }}>
                    {/* Agency detail grid */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '10px', marginTop: '14px', padding: '12px 16px',
                      background: 'rgba(0,0,0,0.02)', borderRadius: '10px',
                    }}>
                      {a.qualification_number && (
                        <div><div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>资质编号</div><div style={{ fontSize: '13px' }}>{a.qualification_number}</div></div>
                      )}
                      {a.qualification_expiry && (
                        <div><div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>资质有效期</div><div style={{ fontSize: '13px' }}>{a.qualification_expiry}</div></div>
                      )}
                      {a.address && (
                        <div><div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}><MapPin size={10} style={{ verticalAlign: 'middle', marginRight: '2px' }} />地址</div><div style={{ fontSize: '13px' }}>{a.address}</div></div>
                      )}
                      {a.email && (
                        <div><div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}><Mail size={10} style={{ verticalAlign: 'middle', marginRight: '2px' }} />邮箱</div><div style={{ fontSize: '13px' }}>{a.email}</div></div>
                      )}
                      {a.contact_phone && (
                        <div><div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>对接人电话</div><div style={{ fontSize: '13px' }}>{a.contact_phone}</div></div>
                      )}
                      {a.contact_email && (
                        <div><div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>对接人邮箱</div><div style={{ fontSize: '13px' }}>{a.contact_email}</div></div>
                      )}
                      {a.remarks && (
                        <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>备注</div><div style={{ fontSize: '13px' }}>{a.remarks}</div></div>
                      )}
                    </div>

                    {/* On-site records section */}
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} color="var(--text-secondary)" /> 进场测评记录 ({agencyRecords.length}条)
                        </div>
                        {hasPermission('onsite:create') && (
                          <button onClick={openCreateRecord} style={{
                            border: 'none', background: 'none', cursor: 'pointer',
                            color: '#007AFF', fontSize: '12px', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '4px',
                          }}>
                            <UserPlus size={14} />新增记录
                          </button>
                        )}
                      </div>

                      {agencyRecords.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                          暂无进场记录
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {agencyRecords.map(r => (
                            <div key={r.id} style={{
                              padding: '10px 14px', borderRadius: '10px',
                              background: 'var(--bg-primary)', border: '1px solid rgba(60,60,67,0.06)',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              flexWrap: 'wrap', gap: '8px',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ fontSize: '13px', fontWeight: 500 }}>
                                  {r.system_name && <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginRight: '6px' }}>[{r.system_name}]</span>}
                                  <Calendar size={12} style={{ verticalAlign: 'middle', marginRight: '4px', color: 'var(--text-tertiary)' }} />
                                  {r.entry_date}{r.exit_date ? ` ~ ${r.exit_date}` : ''}
                                </div>
                                {r.assessment_personnel && (
                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Users size={12} /> 测评人员: {r.assessment_personnel}
                                  </span>
                                )}
                                {r.client_contact_name && (
                                  <span style={{
                                    fontSize: '12px', padding: '2px 8px', borderRadius: '4px',
                                    background: 'rgba(0,122,255,0.08)', color: '#007AFF',
                                  }}>
                                    👤 甲方: {r.client_contact_name}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {hasPermission('onsite:edit') && (
                                  <button onClick={() => openEditRecord(r)} style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    padding: '4px', color: 'var(--text-secondary)', borderRadius: '4px',
                                  }}><Edit2 size={13} /></button>
                                )}
                                {hasPermission('onsite:delete') && (
                                  <button onClick={() => deleteRecord(r.id)} style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    padding: '4px', color: 'var(--text-secondary)', borderRadius: '4px',
                                  }}><Trash2 size={13} /></button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </PageShell>

      {/* Agency Modal */}
      {showAgencyModal && (
        <Modal onClose={() => setShowAgencyModal(false)} title={editingAgency ? '编辑测评机构' : '新增测评机构'}>
          <form onSubmit={saveAgency} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>机构名称 *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>资质等级</label>
                <select className="input" value={form.qualification_level} onChange={e => setForm({ ...form, qualification_level: e.target.value })}>
                  <option value="">请选择</option>
                  <option value="国家级">国家级</option>
                  <option value="省级">省级</option>
                  <option value="市级">市级</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div className="form-group">
                <label>资质编号</label>
                <input className="input" value={form.qualification_number} onChange={e => setForm({ ...form, qualification_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label>资质有效期</label>
                <input type="date" className="input" value={form.qualification_expiry} onChange={e => setForm({ ...form, qualification_expiry: e.target.value })} />
              </div>
              <div className="form-group">
                <label>联系电话</label>
                <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>机构邮箱</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>地址</label>
                <input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(60,60,67,0.08)', paddingTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={14} /> 机构对接人信息
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label>对接人姓名</label>
                  <input className="input" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>对接人电话</label>
                  <input className="input" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>对接人邮箱</label>
                  <input type="email" className="input" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>备注</label>
              <textarea className="input" rows={2} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" className="btn" onClick={() => setShowAgencyModal(false)}>取消</button>
              <button type="submit" className="btn-primary">保存</button>
            </div>
          </form>
        </Modal>
      )}

      {/* On-site Record Modal */}
      {showRecordModal && (
        <Modal onClose={() => setShowRecordModal(false)} title={editingRecord ? '编辑进场记录' : '新增进场记录'}>
          <form onSubmit={saveRecord} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label>关联测评项目</label>
                <select className="input" value={recordForm.assessment_id} onChange={e => setRecordForm({ ...recordForm, assessment_id: e.target.value })}>
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
                <input type="date" className="input" value={recordForm.entry_date} onChange={e => setRecordForm({ ...recordForm, entry_date: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>离场日期</label>
                <input type="date" className="input" value={recordForm.exit_date} onChange={e => setRecordForm({ ...recordForm, exit_date: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>测评人员</label>
                <input className="input" placeholder="多个人员用逗号分隔" value={recordForm.assessment_personnel} onChange={e => setRecordForm({ ...recordForm, assessment_personnel: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>甲方对接人员</label>
                <select className="input" value={recordForm.client_contact_id} onChange={e => setRecordForm({ ...recordForm, client_contact_id: e.target.value })}>
                  <option value="">请选择系统用户</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.real_name} ({u.username}){u.department ? ' — ' + u.department : ''}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>备注</label>
                <textarea className="input" rows={2} value={recordForm.remarks} onChange={e => setRecordForm({ ...recordForm, remarks: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" className="btn" onClick={() => setShowRecordModal(false)}>取消</button>
              <button type="submit" className="btn-primary">保存</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
