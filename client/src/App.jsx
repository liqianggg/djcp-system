import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, Server, ShieldCheck, FileText, 
  AlertTriangle, Wrench, ClipboardCheck, FolderOpen,
  LogOut, User, Users, Shield, ScrollText, Settings,
  ChevronRight, Building2
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Systems from './pages/Systems';
import Classification from './pages/Classification';
import Filing from './pages/Filing';
import GapAnalysis from './pages/GapAnalysis';
import Rectification from './pages/Rectification';
import Assessment from './pages/Assessment';
import AgencyManagement from './pages/AgencyManagement';
import Documents from './pages/Documents';
import UserManagement from './pages/UserManagement';
import PermissionManagement from './pages/PermissionManagement';
import AuditLog from './pages/AuditLog';
import SystemSettings from './pages/SystemSettings';
import RectificationMascot from './pages/RectificationMascot';
import LoginPage from './pages/LoginPage';

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
  agencies:       { bg: 'rgba(0,122,255,0.1)',     color: '#007AFF' },
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

  const handleLogin = async (username, password, loginType) => {
    const res = await fetch(API + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, login_type: loginType || 'local' })
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
    { to: '/agencies', icon: <Building2 size={15} />, label: '测评机构', color: 'agencies' },
  ].filter(i => hasPerm({filing:'filing:view','gapanalysis':'gap:view',rectification:'rectification:view',assessment:'assessment:view',agencies:'agency:view'}[i.color] || true));

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
    '/assessment': 'assessment:view',
    '/agencies': 'agency:view', '/documents': 'document:view',
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

      {token && <RectificationMascot token={token} />}

      <main className="main-content">
        <Routes>
          <Route path="/" element={hasPerm('dashboard:view') ? <Dashboard token={token} /> : <Navigate to="/systems" replace />} />
          <Route path="/systems" element={hasPerm('system:view') ? <Systems token={token} /> : <Navigate to="/" replace />} />
          <Route path="/classification" element={hasPerm('classification:view') ? <Classification token={token} /> : <Navigate to="/" replace />} />
          <Route path="/filing" element={hasPerm('filing:view') ? <Filing token={token} /> : <Navigate to="/" replace />} />
          <Route path="/gap-analysis" element={hasPerm('gap:view') ? <GapAnalysis token={token} /> : <Navigate to="/" replace />} />
          <Route path="/rectification" element={hasPerm('rectification:view') ? <Rectification token={token} /> : <Navigate to="/" replace />} />
          <Route path="/assessment" element={hasPerm('assessment:view') ? <Assessment token={token} /> : <Navigate to="/" replace />} />
          <Route path="/agencies" element={hasPerm('agency:view') ? <AgencyManagement token={token} /> : <Navigate to="/" replace />} />
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


