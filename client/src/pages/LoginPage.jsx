import React, { useState } from 'react';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ldapMode, setLdapMode] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const result = await onLogin(username, password, ldapMode ? 'ldap' : 'local');
    if (!result.success) setError(result.message || '登录失败');
    setLoading(false);
  };

  const ACCOUNTS = [
    ['sysadmin', '系统管理员'],
    ['secadmin', '安全管理员'],
    ['auditor', '安全审计员'],
    ['operator', '操作员'],
    ['viewer', '只读用户'],
  ];

  return (
    <div className="login-page">
      {/* Grid background */}
      <div className="login-grid-bg" />

      {/* Glow effects */}
      <div className="login-glow-left" />
      <div className="login-glow-right" />

      {/* Scan lines */}
      <div className="login-scanlines">
        <div /><div /><div /><div /><div />
      </div>

      {/* Floating particles */}
      <div className="login-particles">
        {[...Array(15)].map((_, i) => (
          <div key={i} className="login-particle" style={{
            background: i % 3 === 0 ? '#0cf' : '#06f',
            left: `${Math.random() * 80 + 10}%`,
            top: `${Math.random() * 100}%`,
            animationDuration: `${Math.random() * 4 + 5}s`,
            animationDelay: `${Math.random() * 5}s`,
          }} />
        ))}
      </div>

      {/* Binary art */}
      <div className="login-binary">
        <div>01001110</div>
        <div style={{ opacity: 0.5 }}>01010100</div>
        <div style={{ opacity: 0.3 }}>01001111</div>
        <div style={{ opacity: 0.5 }}>01001011</div>
        <div style={{ opacity: 0.15 }}>01010011</div>
        <div style={{ opacity: 0.3 }}>01000011</div>
      </div>

      {/* Hero text */}
      <div className="login-hero">
        <div className="login-hero-title">网络安全<br />等级保护</div>
        <div className="login-hero-sub">GRADED PROTECTION SYSTEM</div>
        <div className="login-hero-desc">三权分立 · 全生命周期管理</div>
      </div>

      {/* Login card */}
      <div className="login-card">
        <div className="login-card-corner left" />
        <div className="login-card-corner right" />

        <div className="login-card-header">
          <div className="login-card-icon">🛡️</div>
          <h1>等保测评管理系统</h1>
          <p>登录以继续</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label>Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
            />
          </div>

          <div className="login-field" style={{ marginBottom: error ? 14 : 24 }}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </div>

          <div className="login-ldap-toggle">
            <input
              type="checkbox"
              id="ldapMode"
              checked={ldapMode}
              onChange={e => setLdapMode(e.target.checked)}
            />
            <label htmlFor="ldapMode">域控登录 (LDAP/AD)</label>
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" disabled={loading} className="login-submit">
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <div className="login-accounts">
          <p>默认账号（三权分立）</p>
          <table>
            <thead>
              <tr><th>账号</th><th>角色</th><th>密码</th></tr>
            </thead>
            <tbody>
              {ACCOUNTS.map(([u, r]) => (
                <tr key={u}>
                  <td>{u}</td>
                  <td>{r}</td>
                  <td>admin123</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
