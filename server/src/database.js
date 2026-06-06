const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'djcp.db');
let db; // sql.js database instance
let _initialized = false;

// ===================== SqlJs wrapper =====================
// Wraps sql.js to provide a better-sqlite3-compatible API

function wrapDb(sqlDb) {
  // Auto-save helper
  function save() {
    try {
      const data = sqlDb.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (e) {
      console.error('Database save error:', e.message);
    }
  }

  return {
    exec(sql) {
      sqlDb.run(sql); // sql.js .run() executes without returning results
      save();
    },

    prepare(sql) {
      // Create a fresh statement each time for run/get/all
      return {
        run(...params) {
          try {
            const stmt = sqlDb.prepare(sql);
            stmt.bind(params.flat().map(v => v === undefined ? null : v));
            stmt.step();
            stmt.free();
            const rows = sqlDb.exec("SELECT last_insert_rowid()");
            const lastId = rows.length > 0 && rows[0].values.length > 0 ? rows[0].values[0][0] : 0;
            const changes = sqlDb.getRowsModified();
            save();
            return { lastInsertRowid: lastId, changes };
          } catch (e) {
            console.error('DB run error:', e.message, 'SQL:', sql.slice(0, 120));
            save();
            return { lastInsertRowid: 0, changes: 0 };
          }
        },

        get(...params) {
          try {
            const stmt = sqlDb.prepare(sql);
            if (params.length > 0) stmt.bind(params.flat());
            let row;
            if (stmt.step()) {
              row = stmt.getAsObject();
            }
            stmt.free();
            return row;
          } catch (e) {
            return undefined;
          }
        },

        all(...params) {
          try {
            const stmt = sqlDb.prepare(sql);
            if (params.length > 0) stmt.bind(params.flat());
            const rows = [];
            while (stmt.step()) {
              rows.push(stmt.getAsObject());
            }
            stmt.free();
            return rows;
          } catch (e) {
            return [];
          }
        }
      };
    },

    // Direct access for pragma
    run(sql, params) {
      try {
        sqlDb.run(sql, params);
        save();
      } catch (e) {
        // ignore
      }
    }
  };
}

// ===================== Init =====================
async function initDb() {
  if (_initialized) return db;

  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } catch (e) {
      console.error('Failed to load database, creating new one:', e.message);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  const w = wrapDb(db);

  // Enable WAL and foreign keys via pragma
  db.run("PRAGMA journal_mode=WAL");
  db.run("PRAGMA foreign_keys=ON");

  // Init tables and data
  initTables(w);
  initPermissions(w);
  initRolePermissions(w);
  initSettings(w);
  initDefaultUsers(w);
  // v1.1 migration
  try { db.run("ALTER TABLE assessments ADD COLUMN agency_id INTEGER REFERENCES assessment_agencies(id)"); } catch (_) {}
  try { db.run("ALTER TABLE users ADD COLUMN login_type TEXT DEFAULT 'local'"); } catch (_) {}
  try { db.run("ALTER TABLE users ADD COLUMN last_login DATETIME"); } catch (_) {}
  try { db.run("ALTER TABLE users ADD COLUMN phone TEXT"); } catch (_) {}
  try { db.run("ALTER TABLE users ADD COLUMN email TEXT"); } catch (_) {}
  try { db.run("ALTER TABLE users ADD COLUMN ldap_dn TEXT"); } catch (_) {}
  try { db.run("ALTER TABLE classifications ADD COLUMN classified_by_id INTEGER REFERENCES users(id)"); } catch (_) {}
  try { db.run("ALTER TABLE rectifications ADD COLUMN responsible_person_id INTEGER REFERENCES users(id)"); } catch (_) {}
  try { db.run("ALTER TABLE documents ADD COLUMN keywords TEXT DEFAULT ''"); } catch (_) {}
  try { db.run("ALTER TABLE documents ADD COLUMN updated_at DATETIME"); } catch (_) {}

  // Save after initialization
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));

  _initialized = true;
  console.log('Database initialized');
  return db;
}

// getDb returns the wrapped db instance (must be called after initDb)
function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return wrapDb(db);
}

// ===================== Tables =====================
function initTables(w) {
  w.exec(`
    CREATE TABLE IF NOT EXISTS systems (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, code TEXT UNIQUE, department TEXT, category TEXT CHECK(category IN ('S1','S2','S3','G1','G2','G3')) DEFAULT 'S2', description TEXT, security_level INTEGER CHECK(security_level BETWEEN 1 AND 5), status TEXT CHECK(status IN ('draft','classified','filed','assessing','rectifying','completed')) DEFAULT 'draft', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS classifications (id INTEGER PRIMARY KEY AUTOINCREMENT, system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE, business_impact_level INTEGER CHECK(business_impact_level BETWEEN 1 AND 5), service_scope TEXT, business_dependency TEXT, classification_report TEXT, classified_by TEXT, classified_at DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS filings (id INTEGER PRIMARY KEY AUTOINCREMENT, system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE, filing_number TEXT, filing_authority TEXT, filing_date DATE, approval_date DATE, filing_status TEXT CHECK(filing_status IN ('preparing','submitted','approved','rejected')) DEFAULT 'preparing', filing_document TEXT, filing_year INTEGER, remarks TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS filing_evidences (id INTEGER PRIMARY KEY AUTOINCREMENT, filing_id INTEGER NOT NULL REFERENCES filings(id) ON DELETE CASCADE, file_path TEXT, original_name TEXT, file_size INTEGER, uploaded_by TEXT, uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS gap_analyses (id INTEGER PRIMARY KEY AUTOINCREMENT, system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE, analysis_date DATE, overall_score REAL, compliance_rate REAL, status TEXT CHECK(status IN ('draft','in_progress','completed')) DEFAULT 'draft', report TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS gap_items (id INTEGER PRIMARY KEY AUTOINCREMENT, analysis_id INTEGER NOT NULL REFERENCES gap_analyses(id) ON DELETE CASCADE, requirement_category TEXT, requirement_id TEXT, requirement_desc TEXT, expected_value TEXT, actual_value TEXT, is_compliant INTEGER DEFAULT 0, risk_level TEXT CHECK(risk_level IN ('high','medium','low')), remarks TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS rectifications (id INTEGER PRIMARY KEY AUTOINCREMENT, system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE, gap_item_id INTEGER REFERENCES gap_items(id) ON DELETE SET NULL, title TEXT NOT NULL, description TEXT, responsible_person TEXT, priority TEXT CHECK(priority IN ('urgent','high','medium','low')) DEFAULT 'medium', status TEXT CHECK(status IN ('pending','in_progress','completed','verified')) DEFAULT 'pending', plan_start_date DATE, plan_end_date DATE, actual_start_date DATE, actual_end_date DATE, cost REAL DEFAULT 0, evidence TEXT, remarks TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS rectification_evidences (id INTEGER PRIMARY KEY AUTOINCREMENT, rectification_id INTEGER NOT NULL REFERENCES rectifications(id) ON DELETE CASCADE, file_path TEXT, original_name TEXT, file_size INTEGER, uploaded_by TEXT, uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS assessments (id INTEGER PRIMARY KEY AUTOINCREMENT, system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE, assessment_agency TEXT, agency_id INTEGER REFERENCES assessment_agencies(id), assessment_type TEXT CHECK(assessment_type IN ('initial','reassessment','annual')), assessment_date DATE, overall_score REAL, overall_level TEXT, conclusion TEXT CHECK(conclusion IN ('pass','fail','conditional_pass')), report_number TEXT, assessment_report TEXT, status TEXT CHECK(status IN ('planned','in_progress','completed')) DEFAULT 'planned', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS assessment_agencies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, qualification_level TEXT, qualification_number TEXT, qualification_expiry DATE, address TEXT, phone TEXT, email TEXT, contact_person TEXT, contact_phone TEXT, contact_email TEXT, remarks TEXT, status TEXT CHECK(status IN ('active','inactive')) DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS on_site_records (id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL REFERENCES assessment_agencies(id) ON DELETE CASCADE, assessment_id INTEGER REFERENCES assessments(id) ON DELETE SET NULL, entry_date DATE NOT NULL, exit_date DATE, assessment_personnel TEXT, client_contact_id INTEGER REFERENCES users(id), remarks TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS assessment_items (id INTEGER PRIMARY KEY AUTOINCREMENT, assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE, category TEXT, control_id TEXT, control_desc TEXT, score REAL DEFAULT 0, max_score REAL DEFAULT 5, result TEXT CHECK(result IN ('符合','部分符合','不符合','不适用')), remarks TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY AUTOINCREMENT, system_id INTEGER REFERENCES systems(id) ON DELETE SET NULL, title TEXT, doc_type TEXT CHECK(doc_type IN ('policy','procedure','record','report','evidence','other')), file_path TEXT, file_size INTEGER, version TEXT, description TEXT, status TEXT DEFAULT 'active', uploaded_by TEXT, uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT, real_name TEXT, role TEXT CHECK(role IN ('system_admin','security_admin','security_auditor','operator','viewer')), department TEXT, phone TEXT, email TEXT, status TEXT CHECK(status IN ('active','disabled')) DEFAULT 'active', login_type TEXT DEFAULT 'local', ldap_dn TEXT, last_login DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL, expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT, module TEXT, description TEXT);
    CREATE TABLE IF NOT EXISTS role_permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, permission_code TEXT NOT NULL, UNIQUE(role, permission_code));
    CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, username TEXT, real_name TEXT, action TEXT, module TEXT, target_type TEXT, target_id TEXT, detail TEXT, result TEXT DEFAULT 'success', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, value TEXT, description TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `);
}

// ===================== Permissions =====================
function initPermissions(w) {
  const count = w.prepare('SELECT COUNT(*) as cnt FROM permissions').get();
  if (count && count.cnt > 0) return;

  const stmt = w.prepare('INSERT OR IGNORE INTO permissions (code, name, module, description) VALUES (?,?,?,?)');
  const perms = [
    ['dashboard:view','查看工作台','dashboard','查看系统概览和统计数据'],
    ['system:view','查看信息系统','system','查看信息系统列表与详情'],
    ['system:create','创建信息系统','system','新增信息系统'],
    ['system:edit','编辑信息系统','system','修改信息系统信息'],
    ['system:delete','删除信息系统','system','删除信息系统'],
    ['classification:view','查看定级','classification','查看系统定级信息'],
    ['classification:create','创建定级','classification','对信息系统进行定级'],
    ['classification:report','生成定级报告','classification','生成和查看定级报告'],
    ['filing:view','查看备案','filing','查看备案信息'],
    ['filing:create','创建备案','filing','新增备案记录'],
    ['filing:edit','编辑备案','filing','修改备案信息'],
    ['filing:upload_evidence','上传备案证明','filing','上传备案证明材料图片'],
    ['filing:delete_evidence','删除备案证明','filing','删除备案证明图片'],
    ['gap:view','查看差距分析','gap','查看差距分析'],
    ['gap:create','创建差距分析','gap','创建差距分析'],
    ['gap:import','导入差距分析','gap','从Excel文件导入差距分析数据'],
    ['rectification:view','查看整改','rectification','查看整改任务'],
    ['rectification:create','创建整改','rectification','创建整改任务'],
    ['rectification:edit','编辑整改','rectification','编辑整改任务'],
    ['rectification:status','更新整改状态','rectification','更新整改任务状态'],
    ['assessment:view','查看测评','assessment','查看测评记录'],
    ['assessment:create','创建测评','assessment','创建测评记录'],
    ['document:view','查看文档','document','查看文档列表'],
    ['document:upload','上传文档','document','上传新文档'],
    ['document:edit','编辑文档','document','编辑文档信息'],
    ['document:delete','删除文档','document','删除文档'],
    ['document:download','下载文档','document','下载文档文件'],
    ['user:view','查看用户','user','查看用户列表'],
    ['user:create','创建用户','user','新增用户'],
    ['user:edit','编辑用户','user','编辑用户信息'],
    ['user:delete','删除用户','user','删除用户'],
    ['user:reset_password','重置密码','user','重置用户密码'],
    ['permission:view','查看权限','permission','查看角色权限'],
    ['permission:manage','管理权限','permission','修改角色权限'],
    ['audit:view','查看审计日志','audit','查看操作审计日志'],
    ['audit:export','导出审计日志','audit','导出审计日志为CSV'],
    ['settings:view','查看系统设置','settings','查看系统配置'],
    ['filing:upload_evidence','上传备案证明','filing','上传备案证明材料图片'],
    ['filing:delete_evidence','删除备案证明','filing','删除备案证明图片'],
    ['gap:import','导入差距分析','gap','从Excel/CSV文件导入差距分析数据'],
    ['agency:view','查看测评机构','agency','查看测评机构列表与详情'],
    ['agency:create','创建测评机构','agency','新增测评机构'],
    ['agency:edit','编辑测评机构','agency','修改测评机构信息'],
    ['agency:delete','删除测评机构','agency','删除测评机构'],
    ['onsite:view','查看进场记录','agency','查看进场测评记录'],
    ['onsite:create','创建进场记录','agency','新增进场测评记录'],
    ['onsite:edit','编辑进场记录','agency','修改进场测评记录'],
    ['onsite:delete','删除进场记录','agency','删除进场测评记录'],
  ];
  for (const p of perms) stmt.run(p);
}

function initRolePermissions(w) {
  const count = w.prepare('SELECT COUNT(*) as cnt FROM role_permissions').get();
  if (count && count.cnt > 0) return;

  const allPerms = w.prepare('SELECT code FROM permissions').all().map(p => p.code);
  const rpStmt = w.prepare('INSERT OR IGNORE INTO role_permissions (role, permission_code) VALUES (?,?)');

  // 系统管理员：所有权限
  for (const code of allPerms) rpStmt.run('system_admin', code);

  // 安全管理员
  const secAdminPerms = ['dashboard:view','system:view','system:create','system:edit','system:delete','classification:view','classification:create','classification:report','filing:view','filing:create','filing:edit','filing:upload_evidence','filing:delete_evidence','gap:view','gap:create','gap:import','rectification:view','rectification:create','rectification:edit','rectification:status','assessment:view','assessment:create','document:view','document:upload','document:edit','document:delete','document:download','user:view','user:create','user:edit','user:reset_password','permission:view','permission:manage','settings:view'];
  for (const code of secAdminPerms) rpStmt.run('security_admin', code);

  // 安全审计员
  const auditorPerms = ['dashboard:view','system:view','classification:view','classification:report','filing:view','gap:view','rectification:view','assessment:view','document:view','document:download','user:view','permission:view','audit:view','audit:export'];
  for (const code of auditorPerms) rpStmt.run('security_auditor', code);

  // 操作员
  const operatorPerms = ['dashboard:view','system:view','system:create','system:edit','classification:view','classification:create','classification:report','filing:view','filing:create','filing:edit','filing:upload_evidence','filing:delete_evidence','gap:view','gap:create','gap:import','rectification:view','rectification:create','rectification:edit','rectification:status','assessment:view','assessment:create','document:view','document:upload','document:edit','document:download'];
  for (const code of operatorPerms) rpStmt.run('operator', code);

  // 只读用户
  const viewerPerms = ['dashboard:view','agency:view','onsite:view','system:view','classification:view','classification:report','filing:view','gap:view','rectification:view','assessment:view','document:view','document:download'];
  for (const code of viewerPerms) rpStmt.run('viewer', code);
}

function initSettings(w) {
  const defaults = [
    ['ldap_enabled', 'false', '是否启用域控登录'],
    ['ldap_server', '', 'LDAP 服务器地址'],
    ['ldap_port', '389', 'LDAP 端口'],
    ['ldap_base_dn', '', 'LDAP 基础 DN'],
    ['ldap_domain', '', 'AD 域名'],
    ['ldap_admin_user', '', 'LDAP 管理员账号'],
    ['ldap_admin_password', '', 'LDAP 管理员密码'],
    ['upload_path', 'uploads', '文件上传存储路径'],
  ];
  const stmt = w.prepare('INSERT OR IGNORE INTO settings (key, value, description) VALUES (?,?,?)');
  for (const d of defaults) stmt.run(d);
}

function initDefaultUsers(w) {
  const count = w.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (count && count.cnt > 0) return;

  const stmt = w.prepare('INSERT INTO users (username, password, real_name, role, department, status) VALUES (?,?,?,?,?,?)');
  stmt.run('sysadmin', bcrypt.hashSync('admin123', 10), '系统管理员', 'system_admin', '信息中心', 'active');
  stmt.run('secadmin', bcrypt.hashSync('admin123', 10), '安全管理员', 'security_admin', '安全管理部', 'active');
  stmt.run('auditor', bcrypt.hashSync('admin123', 10), '安全审计员', 'security_auditor', '审计部', 'active');
  stmt.run('operator', bcrypt.hashSync('admin123', 10), '操作员', 'operator', '技术部', 'active');
  stmt.run('viewer', bcrypt.hashSync('admin123', 10), '只读用户', 'viewer', '业务部', 'active');
}

module.exports = { initDb, getDb };
