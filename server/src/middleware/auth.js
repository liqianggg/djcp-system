const jwt = require('jsonwebtoken');
const { getDb } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'djcp_jwt_secret_key_2026';

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
}

function auditLog(db, userId, username, realName, action, module, targetType, targetId, detail, result) {
  db.prepare(`INSERT INTO audit_logs (user_id, username, real_name, action, module, target_type, target_id, detail, result)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(userId, username, realName, action, module, targetType, targetId || null, detail || null, result || 'success');
}

function requirePermission(...permCodes) {
  return (req, res, next) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: '未登录' });

    const db = getDb();
    let userInfo = null;

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.prepare('SELECT id, username, real_name, role, status FROM users WHERE id=?').get(decoded.id);
      if (user && user.status === 'active') {
        userInfo = { id: user.id, username: user.username, real_name: user.real_name, role: user.role };
      }
    } catch (_jwtError) {}

    if (!userInfo) {
      const session = db.prepare(`
        SELECT s.*, u.username, u.real_name, u.role, u.status
        FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > datetime('now')
      `).get(token);

      if (!session) return res.status(401).json({ error: '登录已过期' });
      if (session.status !== 'active') return res.status(403).json({ error: '账号已禁用' });
      userInfo = { id: session.user_id, username: session.username, real_name: session.real_name, role: session.role };
    }

    req.user = userInfo;

    if (permCodes.length > 0) {
      const userPerms = db.prepare('SELECT permission_code FROM role_permissions WHERE role=?').all(userInfo.role).map(p => p.permission_code);
      const hasAll = permCodes.every(code => userPerms.includes(code));
      if (!hasAll) return res.status(403).json({ error: '权限不足', required: permCodes });
    }

    next();
  };
}

// Verify token and attach user, return userInfo or null (for non-critical routes like file serving)
function verifyToken(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return null;

  const db = getDb();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, real_name, role, status FROM users WHERE id=?').get(decoded.id);
    if (user && user.status === 'active') {
      return { id: user.id, username: user.username, real_name: user.real_name, role: user.role };
    }
  } catch (_) {}

  const session = db.prepare(`
    SELECT s.*, u.username, u.real_name, u.role, u.status
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token);

  if (!session || session.status !== 'active') return null;
  return { id: session.user_id, username: session.username, real_name: session.real_name, role: session.role };
}

module.exports = { generateToken, auditLog, requirePermission, verifyToken, JWT_SECRET };
