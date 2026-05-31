import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, Server, ShieldCheck, FileText, 
  AlertTriangle, Wrench, ClipboardCheck, FolderOpen,
  LogOut, User, Users, Shield, ScrollText, Settings,
  ChevronRight
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Systems from './pages/Systems';
import Classification from './pages/Classification';
import Filing from './pages/Filing';
import GapAnalysis from './pages/GapAnalysis';
import Rectification from './pages/Rectification';
import Assessment from './pages/Assessment';
import Documents from './pages/Documents';
import UserManagement from './pages/UserManagement';
import PermissionManagement from './pages/PermissionManagement';
import AuditLog from './pages/AuditLog';
import SystemSettings from './pages/SystemSettings';

const API = '';

const ROLE_LABELS = {
  system_admin: '系统管理员',
  security_admin: '安全管理员',
  security_auditor: '安全审计员',
  operator: '操作员',
  viewer: '只读用户'
};

// Apple-style icon color map
const iconColors = {
  dashboard:     { bg: 'rgba(0,122,255,0.12)',   color: '#007AFF' },
  systems:       { bg: 'rgba(88,86,214,0.12)',    color: '#5856D6' },
  classification:{ bg: 'rgba(52,199,89,0.12)',    color: '#34C759' },
  filing:        { bg: 'rgba(90,200,250,0.12)',   color: '#5AC8FA' },
  gapanalysis:   { bg: 'rgba(255,149,0,0.12)',    color: '#FF9500' },
  rectification: { bg: 'rgba(255,59,48,0.1)',     color: '#FF3B30' },
  assessment:    { bg: 'rgba(175,82,222,0.12)',   color: '#AF52DE' },
  documents:     { bg: 'rgba(50,173,230,0.12)',   color: '#32ADE6' },
  users:         { bg: 'rgba(60,60,67,0.1)',      color: '#48484A' },
  permissions:   { bg: 'rgba(255,204,0,0.15)',    color: '#B38600' },
  audit:         { bg: 'rgba(60,60,67,0.1)',      color: '#48484A' },
  settings:      { bg: 'rgba(60,60,67,0.1)',      color: '#48484A' },
};

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('djcp_user');
    const savedToken = localStorage.getItem('djcp_token');
    if (saved && savedToken) {
      setUser(JSON.parse(saved));
      setToken(savedToken);
    }
    setLoading(false);
  }, []);

  const handleLogin = async (username, password) => {
    const res = await fetch(API + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('djcp_user', JSON.stringify(data.user));
      localStorage.setItem('djcp_token', data.token);
    }
    return data;
  };

  const handleLogout = async () => {
    if (token) {
      await fetch(API + '/api/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('djcp_user');
    localStorage.removeItem('djcp_token');
    navigate('/login');
  };

  if (loading) return null;

  if (!user || !token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const hasPerm = (code) => user.permissions?.includes(code);

  // Apple-style nav items with icons
  const navItem = (to, icon, label, colorKey, end) => (
    <NavLink key={to} to={to} end={end}>
      <span className="nav-icon" style={{ background: iconColors[colorKey]?.bg, color: iconColors[colorKey]?.color }}>
        {icon}
      </span>
      <span className="text">{label}</span>
    </NavLink>
  );

  // Grouped navigation: 业务功能
  const businessItems = [
    { to: '/', icon: <LayoutDashboard size={15} />, label: '工作台', color: 'dashboard', end: true },
    { to: '/systems', icon: <Server size={15} />, label: '信息系统', color: 'systems' },
    { to: '/classification', icon: <ShieldCheck size={15} />, label: '系统定级', color: 'classification' },
  ].filter(i => hasPerm({dashboard:'dashboard:view',systems:'system:view',classification:'classification:view'}[i.color] || i.to === '/' || true));

  const processItems = [
    { to: '/filing', icon: <FileText size={15} />, label: '备案管理', color: 'filing' },
    { to: '/gap-analysis', icon: <AlertTriangle size={15} />, label: '差距分析', color: 'gapanalysis' },
    { to: '/rectification', icon: <Wrench size={15} />, label: '整改管理', color: 'rectification' },
    { to: '/assessment', icon: <ClipboardCheck size={15} />, label: '测评管理', color: 'assessment' },
  ].filter(i => hasPerm({filing:'filing:view','gapanalysis':'gap:view',rectification:'rectification:view',assessment:'assessment:view'}[i.color] || true));

  const resourceItems = [
    { to: '/documents', icon: <FolderOpen size={15} />, label: '文档管理', color: 'documents' },
  ].filter(i => hasPerm({documents:'document:view'}[i.color] || true));

  const adminItems = [
    { to: '/users', icon: <Users size={15} />, label: '用户管理', color: 'users' },
    { to: '/permissions', icon: <Shield size={15} />, label: '权限管理', color: 'permissions' },
    { to: '/audit-log', icon: <ScrollText size={15} />, label: '审计日志', color: 'audit' },
    { to: '/settings', icon: <Settings size={15} />, label: '系统管理', color: 'settings' },
  ].filter(i => hasPerm({users:'user:view',permissions:'permission:view',audit:'audit:view',settings:'settings:view'}[i.color] || true));

  const permMap = {
    '/': 'dashboard:view', '/systems': 'system:view', '/classification': 'classification:view',
    '/filing': 'filing:view', '/gap-analysis': 'gap:view', '/rectification': 'rectification:view',
    '/assessment': 'assessment:view', '/documents': 'document:view',
    '/users': 'user:view', '/permissions': 'permission:view', '/audit-log': 'audit:view',
    '/settings': 'settings:view'
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="app-icon">🛡️</div>
          <h1>等保测评管理系统</h1>
        </div>
        <nav className="sidebar-nav">
          {businessItems.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-label">业务功能</div>
              {businessItems.map(i => navItem(i.to, i.icon, i.label, i.color, i.end))}
            </div>
          )}
          {processItems.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-label">测评流程</div>
              {processItems.map(i => navItem(i.to, i.icon, i.label, i.color, false))}
            </div>
          )}
          {resourceItems.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-label">资源管理</div>
              {resourceItems.map(i => navItem(i.to, i.icon, i.label, i.color, false))}
            </div>
          )}
          {adminItems.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-label">系统管理</div>
              {adminItems.map(i => navItem(i.to, i.icon, i.label, i.color, false))}
            </div>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">
            {(user.real_name || user.username).charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <div className="user-name">{user.real_name || user.username}</div>
            <div className="user-role">{ROLE_LABELS[user.role] || user.role}</div>
          </div>
          <button onClick={handleLogout} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
            padding: '4px', borderRadius: '6px', display: 'flex'
          }}>
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={hasPerm('dashboard:view') ? <Dashboard token={token} /> : <Navigate to="/systems" replace />} />
          <Route path="/systems" element={hasPerm('system:view') ? <Systems token={token} /> : <Navigate to="/" replace />} />
          <Route path="/classification" element={hasPerm('classification:view') ? <Classification token={token} /> : <Navigate to="/" replace />} />
          <Route path="/filing" element={hasPerm('filing:view') ? <Filing token={token} /> : <Navigate to="/" replace />} />
          <Route path="/gap-analysis" element={hasPerm('gap:view') ? <GapAnalysis token={token} /> : <Navigate to="/" replace />} />
          <Route path="/rectification" element={hasPerm('rectification:view') ? <Rectification token={token} /> : <Navigate to="/" replace />} />
          <Route path="/assessment" element={hasPerm('assessment:view') ? <Assessment token={token} /> : <Navigate to="/" replace />} />
          <Route path="/documents" element={hasPerm('document:view') ? <Documents token={token} /> : <Navigate to="/" replace />} />
          <Route path="/users" element={hasPerm('user:view') ? <UserManagement token={token} /> : <Navigate to="/" replace />} />
          <Route path="/permissions" element={hasPerm('permission:view') ? <PermissionManagement token={token} /> : <Navigate to="/" replace />} />
          <Route path="/audit-log" element={hasPerm('audit:view') ? <AuditLog token={token} /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={hasPerm('settings:view') ? <SystemSettings token={token} /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const result = await onLogin(username, password);
    if (!result.success) setError(result.message || '登录失败');
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F5F5F7',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        padding: '48px 44px',
        width: '400px',
        maxWidth: '92vw',
        boxShadow: '0 20px 48px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)'
      }}>
        {/* App Icon */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #007AFF, #5856D6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '24px',
            boxShadow: '0 4px 16px rgba(0,122,255,0.25)'
          }}>🛡️</div>
          <h1 style={{
            fontSize: '22px', fontWeight: 620, color: '#1D1D1F',
            letterSpacing: '-0.022em', marginBottom: '2px'
          }}>等保测评管理系统</h1>
          <p style={{ color: '#86868B', fontSize: '14px', fontWeight: 400 }}>
            三权分立 · 全生命周期管理
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: 500, color: '#1D1D1F',
              marginBottom: '6px', letterSpacing: '-0.01em'
            }}>用户名</label>
            <input
              style={{
                width: '100%', padding: '11px 16px',
                border: '1px solid rgba(60,60,67,0.16)',
                borderRadius: '10px', fontSize: '15px',
                fontFamily: 'inherit', outline: 'none',
                transition: 'all 0.2s ease',
                background: '#F5F5F7',
                color: '#1D1D1F'
              }}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
              onFocus={e => { e.target.style.borderColor = '#007AFF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,122,255,0.12)'; e.target.style.background = '#FFFFFF'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(60,60,67,0.16)'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F5F5F7'; }}
            />
          </div>
          <div style={{ marginBottom: error ? '12px' : '22px' }}>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: 500, color: '#1D1D1F',
              marginBottom: '6px', letterSpacing: '-0.01em'
            }}>密码</label>
            <input
              type="password"
              style={{
                width: '100%', padding: '11px 16px',
                border: '1px solid rgba(60,60,67,0.16)',
                borderRadius: '10px', fontSize: '15px',
                fontFamily: 'inherit', outline: 'none',
                transition: 'all 0.2s ease',
                background: '#F5F5F7',
                color: '#1D1D1F'
              }}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              onFocus={e => { e.target.style.borderColor = '#007AFF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,122,255,0.12)'; e.target.style.background = '#FFFFFF'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(60,60,67,0.16)'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F5F5F7'; }}
            />
          </div>

          {error && (
            <p style={{ color: '#FF3B30', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px',
            background: loading ? '#A0C4FF' : '#007AFF',
            color: '#fff', border: 'none', borderRadius: '12px',
            fontSize: '16px', fontWeight: 590,
            cursor: loading ? 'not-allowed' : 'pointer',
            letterSpacing: '-0.01em',
            boxShadow: '0 2px 8px rgba(0,122,255,0.25)',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit'
          }}>
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        {/* Account Info */}
        <div style={{
          marginTop: '24px', padding: '16px',
          background: '#F5F5F7', borderRadius: '12px',
          border: '1px solid rgba(60,60,67,0.08)'
        }}>
          <p style={{
            fontSize: '12px', fontWeight: 590, color: '#86868B',
            marginBottom: '10px', letterSpacing: '0.02em'
          }}>默认账号（三权分立）</p>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 0', fontSize: '11px', fontWeight: 590, color: '#AEAEB2' }}>账号</th>
                <th style={{ textAlign: 'left', padding: '4px 0', fontSize: '11px', fontWeight: 590, color: '#AEAEB2' }}>角色</th>
                <th style={{ textAlign: 'left', padding: '4px 0', fontSize: '11px', fontWeight: 590, color: '#AEAEB2' }}>密码</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: '3px 0', color: '#1D1D1F' }}>sysadmin</td><td style={{ color: '#1D1D1F' }}>系统管理员</td><td style={{ color: '#86868B' }}>admin123</td></tr>
              <tr><td style={{ padding: '3px 0', color: '#1D1D1F' }}>secadmin</td><td style={{ color: '#1D1D1F' }}>安全管理员</td><td style={{ color: '#86868B' }}>admin123</td></tr>
              <tr><td style={{ padding: '3px 0', color: '#1D1D1F' }}>auditor</td><td style={{ color: '#1D1D1F' }}>安全审计员</td><td style={{ color: '#86868B' }}>admin123</td></tr>
              <tr><td style={{ padding: '3px 0', color: '#1D1D1F' }}>operator</td><td style={{ color: '#1D1D1F' }}>操作员</td><td style={{ color: '#86868B' }}>admin123</td></tr>
              <tr><td style={{ padding: '3px 0', color: '#1D1D1F' }}>viewer</td><td style={{ color: '#1D1D1F' }}>只读用户</td><td style={{ color: '#86868B' }}>admin123</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
