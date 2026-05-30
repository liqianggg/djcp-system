import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, Server, ShieldCheck, FileText, 
  AlertTriangle, Wrench, ClipboardCheck, FolderOpen,
  LogOut, User, Users, Shield, ScrollText
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

const API = '';

const ROLE_LABELS = {
  system_admin: '系统管理员',
  security_admin: '安全管理员',
  security_auditor: '安全审计员',
  operator: '操作员',
  viewer: '只读用户'
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

  const menuItems = [
    { to: '/', icon: <LayoutDashboard size={18} />, label: '工作台', perm: 'dashboard:view' },
    { to: '/systems', icon: <Server size={18} />, label: '信息系统', perm: 'system:view' },
    { to: '/classification', icon: <ShieldCheck size={18} />, label: '系统定级', perm: 'classification:view' },
    { to: '/filing', icon: <FileText size={18} />, label: '备案管理', perm: 'filing:view' },
    { to: '/gap-analysis', icon: <AlertTriangle size={18} />, label: '差距分析', perm: 'gap:view' },
    { to: '/rectification', icon: <Wrench size={18} />, label: '整改管理', perm: 'rectification:view' },
    { to: '/assessment', icon: <ClipboardCheck size={18} />, label: '测评管理', perm: 'assessment:view' },
    { to: '/documents', icon: <FolderOpen size={18} />, label: '文档管理', perm: 'document:view' },
    { to: '/users', icon: <Users size={18} />, label: '用户管理', perm: 'user:view' },
    { to: '/permissions', icon: <Shield size={18} />, label: '权限管理', perm: 'permission:view' },
    { to: '/audit-log', icon: <ScrollText size={18} />, label: '审计日志', perm: 'audit:view' },
  ].filter(item => hasPerm(item.perm));

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>等保测评管理系统</h1>
          <div className="subtitle">三权分立 · 全生命周期</div>
        </div>
        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              {item.icon}
              <span className="text">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <User size={14} style={{ color: 'rgba(255,255,255,0.7)' }} />
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>{user.real_name || user.username}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{ROLE_LABELS[user.role] || user.role}</span>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '2px' }}>
              <LogOut size={14} />
            </button>
          </div>
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
    <div className="login-page">
      <div className="login-card">
        <h1>🔐 等保测评管理系统</h1>
        <p className="login-subtitle">三权分立 · 全生命周期管理平台</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input className="form-control" value={username} onChange={e => setUsername(e.target.value)} placeholder="请输入用户名" autoFocus />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input className="form-control" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码" />
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>
        <div style={{ marginTop: '20px', padding: '12px', background: '#f0fdf4', borderRadius: '8px', fontSize: '12px' }}>
          <p style={{ fontWeight: 600, marginBottom: '6px', color: '#166534' }}>默认账号（三权分立）:</p>
          <table style={{ width: '100%', fontSize: '12px' }}>
            <thead><tr><th style={{textAlign:'left'}}>账号</th><th style={{textAlign:'left'}}>角色</th><th style={{textAlign:'left'}}>密码</th></tr></thead>
            <tbody>
              <tr><td>sysadmin</td><td>系统管理员</td><td>admin123</td></tr>
              <tr><td>secadmin</td><td>安全管理员</td><td>admin123</td></tr>
              <tr><td>auditor</td><td>安全审计员</td><td>admin123</td></tr>
              <tr><td>operator</td><td>操作员</td><td>admin123</td></tr>
              <tr><td>viewer</td><td>只读用户</td><td>admin123</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
