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

  const is = {width:'100%',padding:'11px 16px',border:'1px solid rgba(0,200,255,0.2)',borderRadius:8,fontSize:14,fontFamily:'inherit',outline:'none',background:'rgba(10,10,30,0.5)',color:'#e0e8ff'};
  const fs = {borderColor:'rgba(0,200,255,0.6)',boxShadow:'0 0 20px rgba(0,150,255,0.2), inset 0 0 8px rgba(0,150,255,0.08)',background:'rgba(10,15,35,0.7)'};

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'flex-end',background:'#0a0a1a',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(0,200,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,200,255,0.04) 1px,transparent 1px)',backgroundSize:'60px 60px',animation:'gridMove 20s linear infinite',pointerEvents:'none'}}/>
      <div style={{position:'absolute',top:'-40%',left:'-20%',width:'100%',height:'180%',background:'radial-gradient(ellipse at 30% 50%,rgba(0,120,255,0.1) 0%,transparent 60%)',animation:'glowPulse 6s ease-in-out infinite',pointerEvents:'none'}}/>
      <div style={{position:'absolute',top:'20%',right:'10%',width:500,height:500,background:'radial-gradient(circle,rgba(0,200,255,0.06) 0%,transparent 50%)',pointerEvents:'none'}}/>
      <div style={{position:'absolute',inset:0,pointerEvents:'none',opacity:0.12}}>
        <div style={{position:'absolute',top:'18%',left:0,width:'35%',height:1,background:'linear-gradient(90deg,transparent,#0cf,transparent)'}}/>
        <div style={{position:'absolute',top:'55%',left:'55%',width:'45%',height:1,background:'linear-gradient(90deg,transparent,#06f,transparent)'}}/>
        <div style={{position:'absolute',top:'75%',left:'30%',width:'30%',height:1,background:'linear-gradient(90deg,transparent,#0cf,transparent)'}}/>
        <div style={{position:'absolute',left:'35%',top:'10%',width:1,height:'25%',background:'linear-gradient(0deg,transparent,#06f,transparent)'}}/>
        <div style={{position:'absolute',left:'75%',top:'50%',width:1,height:'30%',background:'linear-gradient(0deg,transparent,#0cf,transparent)'}}/>
      </div>
      <div style={{position:'absolute',inset:0,pointerEvents:'none'}}>
        {[...Array(15)].map((_,i)=>(<div key={i} style={{position:'absolute',width:(Math.random()*3+1)+'px',height:(Math.random()*3+1)+'px',background:i%3===0?'#0cf':'#06f',borderRadius:'50%',left:(Math.random()*80+10)+'%',top:(Math.random()*100)+'%',boxShadow:'0 0 6px '+(i%3===0?'#0cf':'#06f'),animation:'particleFloat '+(Math.random()*4+5)+'s linear infinite',animationDelay:(Math.random()*5)+'s',opacity:0}}/>))}
      </div>
      <div style={{position:'absolute',left:'8%',top:'25%',pointerEvents:'none',opacity:0.035,transform:'rotate(-15deg)',fontFamily:'monospace',fontSize:52,fontWeight:700,color:'#0cf',lineHeight:1,userSelect:'none'}}>
        <div>01001110</div><div style={{opacity:.5}}>01010100</div><div style={{opacity:.3}}>01001111</div><div style={{opacity:.5}}>01001011</div><div style={{opacity:.15}}>01010011</div><div style={{opacity:.3}}>01000011</div>
      </div>
      <div style={{position:'absolute',left:'8%',top:'50%',transform:'translateY(-50%)',pointerEvents:'none',maxWidth:500,userSelect:'none'}}>
        <div style={{fontSize:48,fontWeight:280,color:'#0cf',letterSpacing:'.05em',lineHeight:1.1,marginBottom:12,textShadow:'0 0 40px rgba(0,200,255,.3)'}}>网络安全<br/>等级保护</div>
        <div style={{fontSize:16,fontWeight:300,color:'rgba(0,200,255,.5)',letterSpacing:'.08em'}}>GRADED PROTECTION SYSTEM</div>
        <div style={{marginTop:32,fontSize:14,color:'rgba(0,180,255,.3)',letterSpacing:'.04em',lineHeight:1.6}}>三权分立 · 全生命周期管理</div>
      </div>
      <div style={{position:'relative',zIndex:10,background:'rgba(10,15,35,.75)',backdropFilter:'blur(40px) saturate(200%)',WebkitBackdropFilter:'blur(40px) saturate(200%)',borderRadius:16,border:'1px solid rgba(0,200,255,.15)',padding:'44px 48px',width:400,maxWidth:'90vw',marginRight:'8%',boxShadow:'0 0 60px rgba(0,120,255,.1)'}}>
        <div style={{position:'absolute',top:-1,left:-1,width:30,height:30,borderTop:'2px solid rgba(0,200,255,.3)',borderLeft:'2px solid rgba(0,200,255,.3)',borderRadius:'16px 0 0 0'}}/>
        <div style={{position:'absolute',bottom:-1,right:-1,width:30,height:30,borderBottom:'2px solid rgba(0,200,255,.3)',borderRight:'2px solid rgba(0,200,255,.3)',borderRadius:'0 0 16px 0'}}/>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{width:60,height:60,borderRadius:14,background:'linear-gradient(135deg,#06f,#0cf)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:28,boxShadow:'0 0 30px rgba(0,150,255,.4)'}}>🛡️</div>
          <h1 style={{fontSize:20,fontWeight:620,color:'#e0e8ff',letterSpacing:'.02em',marginBottom:4}}>等保测评管理系统</h1>
          <p style={{color:'rgba(0,200,255,.5)',fontSize:13,letterSpacing:'.04em'}}>登录以继续</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{marginBottom:18}}>
            <label style={{display:'block',fontSize:12,fontWeight:500,color:'rgba(0,200,255,.6)',marginBottom:6,letterSpacing:'.05em',textTransform:'uppercase'}}>Username</label>
            <input style={is} value={username} onChange={e=>setUsername(e.target.value)} placeholder="请输入用户名" autoFocus onFocus={e=>Object.assign(e.target.style,fs)} onBlur={e=>Object.assign(e.target.style,is)}/>
          </div>
          <div style={{marginBottom:error?14:24}}>
            <label style={{display:'block',fontSize:12,fontWeight:500,color:'rgba(0,200,255,.6)',marginBottom:6,letterSpacing:'.05em',textTransform:'uppercase'}}>Password</label>
            <input type="password" style={is} value={password} onChange={e=>setPassword(e.target.value)} placeholder="请输入密码" onFocus={e=>Object.assign(e.target.style,fs)} onBlur={e=>Object.assign(e.target.style,is)}/>
          </div>
          {error&&<p style={{color:'#ff4466',fontSize:13,marginBottom:16,textAlign:'center'}}>{error}</p>}
          <button type="submit" disabled={loading} style={{width:'100%',padding:12,background:loading?'rgba(0,100,200,.3)':'linear-gradient(135deg,#06f,#0af)',color:'#fff',border:'none',borderRadius:8,fontSize:15,fontWeight:600,cursor:loading?'not-allowed':'pointer',letterSpacing:'.04em',boxShadow:loading?'none':'0 0 20px rgba(0,100,255,.4)',transition:'all .3s ease',fontFamily:'inherit'}}>{loading?'登录中...':'登 录'}</button>
        </form>
        <div style={{marginTop:24,padding:14,background:'rgba(0,150,255,.05)',borderRadius:8,border:'1px solid rgba(0,200,255,.1)'}}>
          <p style={{fontSize:11,fontWeight:500,color:'rgba(0,200,255,.4)',marginBottom:10,letterSpacing:'.05em',textTransform:'uppercase'}}>默认账号（三权分立）</p>
          <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
            <thead><tr><th style={{textAlign:'left',padding:'3px 0',fontSize:10,fontWeight:500,color:'rgba(0,200,255,.3)'}}>账号</th><th style={{textAlign:'left',padding:'3px 0',fontSize:10,fontWeight:500,color:'rgba(0,200,255,.3)'}}>角色</th><th style={{textAlign:'left',padding:'3px 0',fontSize:10,fontWeight:500,color:'rgba(0,200,255,.3)'}}>密码</th></tr></thead>
            <tbody>
              {[['sysadmin','系统管理员'],['secadmin','安全管理员'],['auditor','安全审计员'],['operator','操作员'],['viewer','只读用户']].map(([u,r])=>(<tr key={u}><td style={{padding:'2px 0',color:'#a0c8ff'}}>{u}</td><td style={{color:'#a0c8ff'}}>{r}</td><td style={{color:'rgba(0,200,255,.4)'}}>admin123</td></tr>))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
