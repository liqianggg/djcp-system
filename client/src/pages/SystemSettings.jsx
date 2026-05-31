import React, { useState, useEffect } from 'react';
import { Save, Server, Shield, Database, RefreshCw, Wifi, WifiOff, CheckCircle, XCircle, SkipForward, Loader } from 'lucide-react';
import { apiGet, apiPut } from '../api';

export default function SystemSettings() {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('ldap');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    apiGet('/api/settings').then(s => s && setSettings(s));
  }, []);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: { ...prev[key], value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {};
    for (const [k, v] of Object.entries(settings)) {
      payload[k] = v.value;
    }
    await apiPut('/api/settings', { settings: payload });
    setSaving(false);
    alert('配置已保存');
  };

  const tabs = [
    { key: 'ldap', icon: <Server size={14} />, label: 'LDAP/AD 域控' },
    { key: 'system', icon: <Database size={14} />, label: '系统信息' },
    { key: 'security', icon: <Shield size={14} />, label: '安全策略' },
  ];

  const ldapFields = [
    { key: 'ldap_enabled', label: '启用域控登录', type: 'switch' },
    { key: 'ldap_server', label: 'LDAP 服务器地址', placeholder: '如: dc.company.com' },
    { key: 'ldap_port', label: 'LDAP 端口', placeholder: '默认 389' },
    { key: 'ldap_domain', label: 'AD 域名', placeholder: '如: company.com' },
    { key: 'ldap_base_dn', label: 'LDAP 基础 DN', placeholder: '如: DC=company,DC=com' },
    { key: 'ldap_admin_user', label: 'LDAP 管理员账号', placeholder: '如: administrator' },
    { key: 'ldap_admin_password', label: 'LDAP 管理员密码', type: 'password', placeholder: '管理员密码' },
  ];

  const handleLdapTest = async () => {
    setTesting(true);
    setTestResult({ steps: [{ step: 1, name: 'TCP 连接', status: 'running', message: '正在连接...', elapsed: 0 }] });
    try {
      const res = await fetch('/api/settings/ldap/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('djcp_token') },
        body: JSON.stringify({
          ldap_server: settingVal('ldap_server'),
          ldap_port: settingVal('ldap_port'),
          ldap_domain: settingVal('ldap_domain'),
          ldap_base_dn: settingVal('ldap_base_dn'),
          ldap_admin_user: settingVal('ldap_admin_user'),
          ldap_admin_password: settingVal('ldap_admin_password'),
        })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ success: false, message: '网络请求失败: ' + e.message, steps: [] });
    }
    setTesting(false);
  };

  const settingVal = (key) => settings[key]?.value || '';

  return (
    <div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="page-header">
        <h2>⚙️ 系统管理</h2>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? '保存中...' : '保存配置'}
        </button>
      </div>

      <div className="page-body">
        <div className="tabs">
          {tabs.map(t => (
            <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'ldap' && (
          <div className="card">
            <div className="card-header">
              <Server size={16} /> LDAP/Active Directory 域控配置
            </div>
            <div className="card-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
                配置后，可将用户登录方式设为"域控认证"，使用企业 AD 账号登录系统。需确保服务器能访问 LDAP 服务。
              </p>
              {ldapFields.map(f => (
                <div key={f.key} className="form-group">
                  <label>{f.label}</label>
                  {f.type === 'switch' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <div
                        onClick={() => updateSetting(f.key, settingVal(f.key) === 'true' ? 'false' : 'true')}
                        style={{
                          width: '44px', height: '24px', borderRadius: '12px',
                          background: settingVal(f.key) === 'true' ? '#22c55e' : '#d1d5db',
                          position: 'relative', transition: 'background 0.2s'
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: '2px',
                          left: settingVal(f.key) === 'true' ? '22px' : '2px',
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          transition: 'left 0.2s'
                        }} />
                      </div>
                      <span style={{ fontSize: '13px', color: settingVal(f.key) === 'true' ? '#16a34a' : '#6b7280' }}>
                        {settingVal(f.key) === 'true' ? '已启用' : '已禁用'}
                      </span>
                    </label>
                  ) : f.type === 'password' ? (
                    <input
                      className="form-control"
                      type="password"
                      value={settingVal(f.key)}
                      onChange={e => updateSetting(f.key, e.target.value)}
                      placeholder={f.placeholder}
                    />
                  ) : (
                    <input
                      className="form-control"
                      value={settingVal(f.key)}
                      onChange={e => updateSetting(f.key, e.target.value)}
                      placeholder={f.placeholder}
                    />
                  )}
                  {settings[f.key]?.description && (
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{settings[f.key].description}</p>
                  )}
                </div>
              ))}
              <div className="form-group" style={{ marginTop: '20px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button type="button" className="btn btn-primary" onClick={handleLdapTest} disabled={testing}>
                    <Wifi size={16} /> {testing ? '测试中...' : '测试连接'}
                  </button>
                  {testResult && (
                    <div style={{ marginTop: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                      {/* 总体状态 */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px',
                        background: testResult.success ? '#f0fdf4' : '#fef2f2',
                        borderBottom: '1px solid ' + (testResult.success ? '#bbf7d0' : '#fecaca')
                      }}>
                        {testResult.success ? <CheckCircle size={18} style={{color:'#16a34a'}} /> : <XCircle size={18} style={{color:'#dc2626'}} />}
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: testResult.success ? '#166534' : '#991b1b' }}>
                            {testResult.message || (testResult.success ? '测试通过' : '测试失败')}
                          </span>
                          {testResult.elapsed != null && (
                            <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                              总耗时: {testResult.elapsed}ms
                            </span>
                          )}
                        </div>
                      </div>
                      {/* 步骤详情 */}
                      {testResult.steps && testResult.steps.length > 0 && (
                        <div style={{ padding: '8px 12px' }}>
                          {testResult.steps.map((s, i) => (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'flex-start', gap: '10px',
                              padding: '8px 4px',
                              borderBottom: i < testResult.steps.length - 1 ? '1px solid #f3f4f6' : 'none'
                            }}>
                              {/* 状态图标 */}
                              <div style={{ marginTop: '2px', flexShrink: 0 }}>
                                {s.status === 'pass' && <CheckCircle size={16} style={{color:'#16a34a'}} />}
                                {s.status === 'fail' && <XCircle size={16} style={{color:'#dc2626'}} />}
                                {s.status === 'skip' && <SkipForward size={16} style={{color:'#9ca3af'}} />}
                                {s.status === 'running' && <Loader size={16} style={{color:'#3b82f6', animation: 'spin 1s linear infinite'}} />}
                              </div>
                              {/* 步骤信息 */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{
                                    fontSize: '10px', fontWeight: 600, color: '#fff',
                                    background: s.status === 'pass' ? '#16a34a' : s.status === 'fail' ? '#dc2626' : s.status === 'skip' ? '#9ca3af' : '#3b82f6',
                                    borderRadius: '10px', padding: '1px 8px', flexShrink: 0
                                  }}>
                                    步骤 {s.step}
                                  </span>
                                  <span style={{ fontSize: '13px', fontWeight: 500 }}>{s.name}</span>
                                  {s.elapsed > 0 && (
                                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{s.elapsed}ms</span>
                                  )}
                                </div>
                                <div style={{
                                  fontSize: '12px', marginTop: '2px',
                                  color: s.status === 'fail' ? '#dc2626' : s.status === 'pass' ? '#166534' : '#6b7280'
                                }}>
                                  {s.message}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="card">
            <div className="card-header">
              <Database size={16} /> 系统信息
            </div>
            <div className="card-body">
              <div className="stats-grid" style={{ marginBottom: 0 }}>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(91,95,227,0.12)' }}><Database size={20} style={{ color: '#5B5FE3' }} /></div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '18px' }}>等保测评管理系统</div>
                    <div className="stat-label">系统名称</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#d1fae5' }}><Shield size={20} style={{ color: '#065f46' }} /></div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '18px' }}>v1.0.0</div>
                    <div className="stat-label">版本号</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#fef3c7' }}><RefreshCw size={20} style={{ color: '#92400e' }} /></div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '18px' }}>Node.js + React</div>
                    <div className="stat-label">技术栈</div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '20px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                <h4 style={{ marginBottom: '12px' }}>数据库信息</h4>
                <div className="detail-grid">
                  <div className="detail-item"><span className="label">数据库类型</span><span className="value">SQLite (better-sqlite3)</span></div>
                  <div className="detail-item"><span className="label">认证方式</span><span className="value">JWT + Session 双模式</span></div>
                  <div className="detail-item"><span className="label">前端框架</span><span className="value">React 19 + Vite 8</span></div>
                  <div className="detail-item"><span className="label">后端框架</span><span className="value">Express 5</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="card">
            <div className="card-header">
              <Shield size={16} /> 安全策略
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gap: '16px' }}>
                {[
                  { title: '密码策略', desc: '支持本地密码认证和 LDAP 域控认证双模式', status: 'active' },
                  { title: '会话管理', desc: 'JWT Token 24小时有效期，支持 Session 回退', status: 'active' },
                  { title: '访问控制', desc: '基于角色的权限控制（RBAC），三权分立模型', status: 'active' },
                  { title: '审计追溯', desc: '全操作审计日志记录，支持 CSV 导出', status: 'active' },
                  { title: 'CORS 防护', desc: '已配置跨域访问控制策略', status: 'active' },
                  { title: 'SQL 注入防护', desc: '使用参数化查询，防止 SQL 注入攻击', status: 'active' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <span className="status-dot active" />
                    <div>
                      <strong style={{ fontSize: '14px' }}>{item.title}</strong>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
