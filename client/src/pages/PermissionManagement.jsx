import React, { useState, useEffect } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { apiGet, apiPut, hasPermission } from '../api';

const ROLE_LABELS = {
  system_admin: '系统管理员', security_admin: '安全管理员',
  security_auditor: '安全审计员', operator: '操作员', viewer: '只读用户'
};
const ROLE_COLORS = {
  system_admin: '#ef4444', security_admin: '#3b82f6',
  security_auditor: '#10b981', operator: '#f59e0b', viewer: '#9ca3af'
};

const MODULE_LABELS = {
  dashboard: '仪表盘', system: '信息系统', classification: '系统定级',
  filing: '备案管理', gap: '差距分析', rectification: '整改管理',
  assessment: '测评管理', document: '文档管理',
  user: '用户管理', permission: '权限管理', audit: '审计日志'
};

export default function PermissionManagement() {
  const [data, setData] = useState(null);
  const [selectedRole, setSelectedRole] = useState('system_admin');
  const [rolePerms, setRolePerms] = useState({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => { loadPermissions(); }, []);

  const loadPermissions = async () => {
    const result = await apiGet('/api/permissions');
    if (result) {
      setData(result);
      // 从后端数据初始化各角色权限
      const rp = {};
      for (const role of result.roles) {
        rp[role] = new Set();
        for (const mod of result.modules) {
          for (const p of mod.permissions) {
            if (p.roles[role]) rp[role].add(p.code);
          }
        }
      }
      setRolePerms(rp);
    }
  };

  const togglePerm = (code) => {
    const newSet = new Set(rolePerms[selectedRole] || []);
    if (newSet.has(code)) newSet.delete(code);
    else newSet.add(code);
    setRolePerms({ ...rolePerms, [selectedRole]: newSet });
    setDirty(true);
  };

  const selectAllInModule = (mod) => {
    const newSet = new Set(rolePerms[selectedRole] || []);
    const allSelected = mod.permissions.every(p => newSet.has(p.code));
    for (const p of mod.permissions) {
      if (allSelected) newSet.delete(p.code);
      else newSet.add(p.code);
    }
    setRolePerms({ ...rolePerms, [selectedRole]: newSet });
    setDirty(true);
  };

  const handleSave = async () => {
    const perms = Array.from(rolePerms[selectedRole] || []);
    await apiPut('/api/permissions', { role: selectedRole, permissions: perms });
    setDirty(false);
    // 重新加载以获取服务端确认
    loadPermissions();
    alert('权限保存成功！该角色用户需重新登录后生效。');
  };

  const handleReset = () => loadPermissions();

  if (!data) return <div className="page-body">加载中...</div>;

  const canManage = hasPermission('permission:manage');

  return (
    <div>
      <div className="page-header">
        <h2>🔐 权限管理（功能按钮级）</h2>
        <div className="toolbar">
          {canManage && (
            <>
              <button className={`btn btn-primary`} onClick={handleSave} disabled={!dirty}>
                <Save size={16} /> 保存权限
              </button>
              <button className="btn" onClick={handleReset} disabled={!dirty}>
                <RotateCcw size={16} /> 重置
              </button>
            </>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Role selector */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-body">
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {data.roles.map(role => (
                <button
                  key={role}
                  onClick={() => { setSelectedRole(role); setDirty(false); }}
                  style={{
                    padding: '10px 20px', borderRadius: '8px', border: `2px solid ${selectedRole === role ? ROLE_COLORS[role] : 'var(--border)'}`,
                    background: selectedRole === role ? ROLE_COLORS[role] + '15' : '#fff',
                    cursor: 'pointer', fontWeight: selectedRole === role ? 600 : 400,
                    color: selectedRole === role ? ROLE_COLORS[role] : 'var(--text)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontSize: '14px' }}>{ROLE_LABELS[role]}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {rolePerms[role]?.size || 0} 项权限
                  </div>
                </button>
              ))}
            </div>
            {!canManage && (
              <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                ⚠️ 您没有权限修改权限配置，仅可查看。
              </p>
            )}
          </div>
        </div>

        {/* Permission matrix */}
        {data.modules.map(mod => (
          <div key={mod.name} className="card" style={{ marginBottom: '12px' }}>
            <div
              className="card-header"
              style={{ cursor: canManage ? 'pointer' : 'default' }}
              onClick={() => canManage && selectAllInModule(mod)}
            >
              <span>📁 {MODULE_LABELS[mod.name] || mod.name}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {mod.permissions.filter(p => rolePerms[selectedRole]?.has(p.code)).length}/{mod.permissions.length} 项
                {canManage && ' - 点击全选/取消'}
              </span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                {mod.permissions.map(p => {
                  const checked = rolePerms[selectedRole]?.has(p.code) || false;
                  return (
                    <label
                      key={p.code}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 12px', borderRadius: '6px',
                        background: checked ? ROLE_COLORS[selectedRole] + '10' : '#fafafa',
                        border: `1px solid ${checked ? ROLE_COLORS[selectedRole] + '40' : 'var(--border)'}`,
                        cursor: canManage ? 'pointer' : 'default',
                        transition: 'all 0.2s'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => canManage && togglePerm(p.code)}
                        disabled={!canManage}
                        style={{ accentColor: ROLE_COLORS[selectedRole] }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <code>{p.code}</code>
                          {p.description && ` - ${p.description}`}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        <div className="card" style={{ marginTop: '16px' }}>
          <div className="card-header">📋 权限说明</div>
          <div className="card-body" style={{ fontSize: '14px', lineHeight: '1.8' }}>
            <p><strong>三权分立原则</strong>：根据等保2.0要求，系统需实现管理员、安全员、审计员三权分立。</p>
            <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
              <li><strong>系统管理员</strong>：负责系统运行维护和用户账号管理，拥有全部权限。</li>
              <li><strong>安全管理员</strong>：负责安全策略和权限分配，可管理用户和业务数据，但不能删除用户和查看审计日志。</li>
              <li><strong>安全审计员</strong>：独立审计角色，只能查看所有数据和审计日志，不能进行任何增删改操作。</li>
              <li><strong>操作员</strong>：日常业务操作，可进行数据录入和编辑，但不能管理用户和权限。</li>
              <li><strong>只读用户</strong>：仅可查看数据，无任何增删改权限。</li>
            </ul>
            <p style={{ marginTop: '12px', color: 'var(--warning)' }}>
              ⚠️ 权限修改后，该角色下的所有用户需重新登录才能生效。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
