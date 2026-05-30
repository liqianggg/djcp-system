import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Key, Search, UserX, UserCheck } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete, hasPermission } from '../api';

const ROLE_LABELS = {
  system_admin: '系统管理员', security_admin: '安全管理员',
  security_auditor: '安全审计员', operator: '操作员', viewer: '只读用户'
};
const ROLE_COLORS = {
  system_admin: 'badge-red', security_admin: 'badge-blue',
  security_auditor: 'badge-green', operator: 'badge-yellow', viewer: 'badge-gray'
};

const emptyUser = { username: '', password: '', real_name: '', role: 'operator', department: '', phone: '', email: '', login_type: 'local', ldap_dn: '' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyUser);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ id: '', username: '', new_password: '' });

  const loadUsers = async () => {
    const data = await apiGet('/api/users');
    if (data) setUsers(data);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) {
      await apiPut('/api/users/' + editing.id, form);
    } else {
      await apiPost('/api/users', form);
    }
    setShowModal(false); setEditing(null); setForm(emptyUser);
    loadUsers();
  };

  const handleEdit = (u) => {
    setEditing(u);
    setForm({ username: u.username, password: '', real_name: u.real_name, role: u.role, department: u.department || '', phone: u.phone || '', email: u.email || '', status: u.status, login_type: u.login_type || 'local', ldap_dn: u.ldap_dn || '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除该用户吗？此操作不可撤销。')) return;
    await apiDelete('/api/users/' + id);
    loadUsers();
  };

  const handleResetPwd = async (e) => {
    e.preventDefault();
    await apiPost('/api/users/' + pwdForm.id + '/reset-password', { new_password: pwdForm.new_password });
    setShowPwdModal(false);
    alert('密码重置成功');
  };

  const handleToggleStatus = async (u) => {
    const newStatus = u.status === 'active' ? 'disabled' : 'active';
    await apiPut('/api/users/' + u.id, { real_name: u.real_name, role: u.role, department: u.department, phone: u.phone, email: u.email, status: newStatus });
    loadUsers();
  };

  return (
    <div>
      <div className="page-header">
        <h2>👥 用户管理（三权分立）</h2>
        {hasPermission('user:create') && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(emptyUser); setShowModal(true); }}>
            <Plus size={16} /> 新建用户
          </button>
        )}
      </div>

      <div className="page-body">
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header">📋 三权分立说明</div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
            {[
              { role: 'system_admin', title: '系统管理员', desc: '负责用户账号管理、系统配置和维护。可创建/删除/编辑用户，管理系统运行参数。', icon: '🖥️' },
              { role: 'security_admin', title: '安全管理员', desc: '负责安全策略制定、权限分配、安全标记和授权管理。决定各角色能访问哪些功能。', icon: '🛡️' },
              { role: 'security_auditor', title: '安全审计员', desc: '负责审计日志查看、安全事件分析和合规检查。对所有操作进行独立审计监督。', icon: '📊' },
            ].map(item => (
              <div key={item.role} style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>{item.icon}</div>
                <h4 style={{ marginBottom: '4px' }}>{item.title}</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>用户名</th><th>姓名</th><th>角色</th><th>部门</th><th>电话</th><th>邮箱</th>
                  <th>登录方式</th><th>状态</th><th>最后登录</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan="10" className="empty-state"><h3>暂无用户</h3></td></tr>
                ) : users.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.username}</strong></td>
                    <td>{u.real_name}</td>
                    <td><span className={`badge ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span></td>
                    <td>{u.department || '-'}</td>
                    <td>{u.phone || '-'}</td>
                    <td>{u.email || '-'}</td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                        {u.status === 'active' ? '正常' : '禁用'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px' }}>{u.last_login || '从未登录'}</td>
                    <td>
                      <div className="toolbar">
                        {hasPermission('user:edit') && (
                          <button className="btn btn-sm" onClick={() => handleEdit(u)} title="编辑"><Edit2 size={14} /></button>
                        )}
                        {hasPermission('user:reset_password') && (
                          <button className="btn btn-sm" onClick={() => { setPwdForm({ id: u.id, username: u.username, new_password: 'Abc@12345' }); setShowPwdModal(true); }} title="重置密码"><Key size={14} /></button>
                        )}
                        {hasPermission('user:edit') && (
                          <button className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-success'}`} onClick={() => handleToggleStatus(u)} title={u.status === 'active' ? '禁用' : '启用'}>
                            {u.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                        )}
                        {hasPermission('user:delete') && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u.id)} title="删除"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              {editing ? '编辑用户' : '新建用户'}
              <button className="btn btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>用户名 *</label>
                    <input className="form-control" required value={form.username} onChange={e => setForm({...form, username: e.target.value})} disabled={!!editing} placeholder="登录用户名" />
                  </div>
                  <div className="form-group">
                    <label>姓名 *</label>
                    <input className="form-control" required value={form.real_name} onChange={e => setForm({...form, real_name: e.target.value})} placeholder="真实姓名" />
                  </div>
                </div>
                {!editing && (
                  <div className="form-group">
                    <label>密码 *</label>
                    <input className="form-control" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="初始密码" />
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>角色 *</label>
                    <select className="form-control" required value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                      {Object.entries(ROLE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>登录方式</label>
                    <select className="form-control" value={form.login_type || 'local'} onChange={e => setForm({...form, login_type: e.target.value})}>
                      <option value="local">本地认证</option>
                      <option value="ldap">域控认证 (LDAP/AD)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>部门</label>
                    <input className="form-control" value={form.department} onChange={e => setForm({...form, department: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>电话</label>
                    <input className="form-control" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>邮箱</label>
                    <input className="form-control" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>LDAP DN (域控用户可留空)</label>
                  <input className="form-control" value={form.ldap_dn || ''} onChange={e => setForm({...form, ldap_dn: e.target.value})} placeholder="例如: CN=username,OU=Users,DC=example,DC=com" />
                </div>
                {editing && (
                  <div className="form-group">
                    <label>状态</label>
                    <select className="form-control" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                      <option value="active">正常</option>
                      <option value="disabled">禁用</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">{editing ? '保存' : '创建'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPwdModal && (
        <div className="modal-overlay" onClick={() => setShowPwdModal(false)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              重置密码 - {pwdForm.username}
              <button className="btn btn-sm" onClick={() => setShowPwdModal(false)}>✕</button>
            </div>
            <form onSubmit={handleResetPwd}>
              <div className="modal-body">
                <div className="form-group">
                  <label>新密码</label>
                  <input className="form-control" required value={pwdForm.new_password} onChange={e => setPwdForm({...pwdForm, new_password: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowPwdModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">确认重置</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
