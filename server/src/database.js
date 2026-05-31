const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'djcp.db');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
    initSettings();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS systems (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, code TEXT UNIQUE, department TEXT, category TEXT CHECK(category IN ('S1','S2','S3','G1','G2','G3')) DEFAULT 'S2', description TEXT, security_level INTEGER CHECK(security_level BETWEEN 1 AND 5), status TEXT CHECK(status IN ('draft','classified','filed','assessing','rectifying','completed')) DEFAULT 'draft', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS classifications (id INTEGER PRIMARY KEY AUTOINCREMENT, system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE, business_impact_level INTEGER CHECK(business_impact_level BETWEEN 1 AND 5), service_scope TEXT, business_dependency TEXT, classification_report TEXT, classified_by TEXT, classified_at DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS filings (id INTEGER PRIMARY KEY AUTOINCREMENT, system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE, filing_number TEXT, filing_authority TEXT, filing_date DATE, approval_date DATE, filing_status TEXT CHECK(filing_status IN ('preparing','submitted','approved','rejected')) DEFAULT 'preparing', filing_document TEXT, filing_year INTEGER, remarks TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS gap_analyses (id INTEGER PRIMARY KEY AUTOINCREMENT, system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE, analysis_date DATE, overall_score REAL, compliance_rate REAL, status TEXT CHECK(status IN ('draft','in_progress','completed')) DEFAULT 'draft', report TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS gap_items (id INTEGER PRIMARY KEY AUTOINCREMENT, analysis_id INTEGER NOT NULL REFERENCES gap_analyses(id) ON DELETE CASCADE, requirement_category TEXT, requirement_id TEXT, requirement_desc TEXT, expected_value TEXT, actual_value TEXT, is_compliant INTEGER DEFAULT 0, risk_level TEXT CHECK(risk_level IN ('high','medium','low')), remarks TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS rectifications (id INTEGER PRIMARY KEY AUTOINCREMENT, system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE, gap_item_id INTEGER REFERENCES gap_items(id) ON DELETE SET NULL, title TEXT NOT NULL, description TEXT, responsible_person TEXT, priority TEXT CHECK(priority IN ('urgent','high','medium','low')) DEFAULT 'medium', status TEXT CHECK(status IN ('pending','in_progress','completed','verified')) DEFAULT 'pending', plan_start_date DATE, plan_end_date DATE, actual_start_date DATE, actual_end_date DATE, cost REAL DEFAULT 0, evidence TEXT, remarks TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS assessments (id INTEGER PRIMARY KEY AUTOINCREMENT, system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE, assessment_agency TEXT, assessment_type TEXT CHECK(assessment_type IN ('initial','reassessment','annual')), assessment_date DATE, overall_score REAL, overall_level TEXT, conclusion TEXT CHECK(conclusion IN ('pass','fail','conditional_pass')), report_number TEXT, assessment_report TEXT, status TEXT CHECK(status IN ('planned','in_progress','completed')) DEFAULT 'planned', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    
    CREATE TABLE IF NOT EXISTS assessment_agencies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, qualification_level TEXT, qualification_number TEXT, qualification_expiry DATE, address TEXT, phone TEXT, email TEXT, contact_person TEXT, contact_phone TEXT, contact_email TEXT, remarks TEXT, status TEXT CHECK(status IN ('active','inactive')) DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS on_site_records (id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL REFERENCES assessment_agencies(id) ON DELETE CASCADE, assessment_id INTEGER REFERENCES assessments(id) ON DELETE SET NULL, entry_date DATE NOT NULL, exit_date DATE, assessment_personnel TEXT, client_contact_id INTEGER REFERENCES users(id), remarks TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS assessment_items (id INTEGER PRIMARY KEY AUTOINCREMENT, assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE, category TEXT, control_id TEXT, control_desc TEXT, score REAL DEFAULT 0, max_score REAL DEFAULT 5, result TEXT CHECK(result IN ('符合','部分符合','不符合','不适用')), remarks TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY AUTOINCREMENT, system_id INTEGER REFERENCES systems(id) ON DELETE SET NULL, title TEXT NOT NULL, doc_type TEXT CHECK(doc_type IN ('policy','procedure','record','report','evidence','other')), file_path TEXT, file_size INTEGER, version TEXT DEFAULT '1.0', status TEXT CHECK(status IN ('draft','reviewed','approved','archived')) DEFAULT 'draft', uploaded_by TEXT, uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP, description TEXT);
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, real_name TEXT, role TEXT CHECK(role IN ('system_admin','security_admin','security_auditor','operator','viewer')) DEFAULT 'operator', department TEXT, phone TEXT, email TEXT, login_type TEXT CHECK(login_type IN ('local','ldap')) DEFAULT 'local', ldap_dn TEXT, status TEXT CHECK(status IN ('active','disabled')) DEFAULT 'active', last_login DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, module TEXT NOT NULL, description TEXT);
    CREATE TABLE IF NOT EXISTS role_permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, permission_code TEXT NOT NULL, FOREIGN KEY (permission_code) REFERENCES permissions(code) ON DELETE CASCADE, UNIQUE(role, permission_code));
    CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, username TEXT, real_name TEXT, action TEXT NOT NULL, module TEXT, target_type TEXT, target_id TEXT, detail TEXT, ip_address TEXT, result TEXT CHECK(result IN ('success','failure')) DEFAULT 'success', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, value TEXT, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT UNIQUE NOT NULL, expires_at DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `);

  // v1.1 migration: add agency_id to assessments
  try { db.exec("ALTER TABLE assessments ADD COLUMN agency_id INTEGER REFERENCES assessment_agencies(id)"); } catch(e) {}
  initPermissions();
  initRolePermissions();
  initDefaultUsers();
}

function initPermissions() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM permissions').get();
  if (count.cnt > 0) return;
  const stmt = db.prepare('INSERT OR IGNORE INTO permissions (code, name, module, description) VALUES (?,?,?,?)');
  const perms = [
    ['dashboard:view','查看仪表盘','dashboard','查看工作台统计概览'],
    ['system:view','查看信息系统','system','查看信息系统列表和详情'],
    ['system:create','创建信息系统','system','新建信息系统'],
    ['system:edit','编辑信息系统','system','修改信息系统信息'],
    ['system:delete','删除信息系统','system','删除信息系统'],
    ['classification:view','查看定级','classification','查看定级记录'],
    ['classification:create','创建定级','classification','新建系统定级'],
    ['filing:view','查看备案','filing','查看备案记录'],
    ['filing:create','创建备案','filing','新建备案记录'],
    ['filing:edit','编辑备案','filing','修改备案记录'],
    ['gap:view','查看差距分析','gap','查看差距分析记录'],
    ['gap:create','创建差距分析','gap','新建差距分析'],
    ['rectification:view','查看整改','rectification','查看整改任务'],
    ['rectification:create','创建整改','rectification','新建整改任务'],
    ['rectification:edit','编辑整改','rectification','编辑整改任务'],
    ['rectification:status','更改整改状态','rectification','推进整改任务状态'],
    ['assessment:view','查看测评','assessment','查看测评记录'],
    ['assessment:create','创建测评','assessment','新建测评记录'],
    ['document:view','查看文档','document','查看文档列表'],
    ['document:upload','上传文档','document','上传新文档'],
    ['document:edit','编辑文档','document','编辑文档信息'],
    ['document:delete','删除文档','document','删除文档'],
    ['document:download','agency:view','agency:create','agency:edit','onsite:view','onsite:create','onsite:edit','下载文档','document','下载文档文件'],
    ['user:view','查看用户','user','查看用户列表'],
    ['user:create','创建用户','user','新建用户账号'],
    ['user:edit','编辑用户','user','修改用户信息'],
    ['user:delete','删除用户','user','删除用户账号'],
    ['user:reset_password','重置密码','user','重置用户密码'],
    ['permission:view','查看权限','permission','查看角色权限配置'],
    ['permission:manage','管理权限','permission','分配/修改角色权限'],
    ['audit:view','查看审计日志','audit','查看操作审计日志'],
    ['settings:view','agency:view','agency:create','agency:edit','agency:delete','onsite:view','onsite:create','onsite:edit','onsite:delete','查看系统配置','settings','查看和修改系统配置（LDAP、安全策略等）'],
    ['audit:export','agency:view','onsite:view','导出审计日志','audit','导出审计日志'],
    ['classification:report','查看定级报告','classification','生成和查看定级报告'],
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
  for (const p of perms) stmt.run(...p);
}

function initRolePermissions() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM role_permissions').get();
  if (count.cnt > 0) return;

  const allPerms = db.prepare('SELECT code FROM permissions').all().map(p => p.code);
  const rpStmt = db.prepare('INSERT OR IGNORE INTO role_permissions (role, permission_code) VALUES (?,?)');

  // 系统管理员：所有权限
  for (const code of allPerms) rpStmt.run('system_admin', code);
  // 测评机构权限已包含在allPerms中

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


function initSettings() {
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
  const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value, description) VALUES (?,?,?)');
  for (const d of defaults) stmt.run(...d);
}

function initDefaultUsers() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (count.cnt > 0) return;

  // INSERT: (username, password, real_name, role, department, status)
  const stmt = db.prepare('INSERT INTO users (username, password, real_name, role, department, status) VALUES (?,?,?,?,?,?)');
  stmt.run('sysadmin', bcrypt.hashSync('admin123', 10), '系统管理员', 'system_admin', '信息中心', 'active');
  stmt.run('secadmin', bcrypt.hashSync('admin123', 10), '安全管理员', 'security_admin', '安全管理部', 'active');
  stmt.run('auditor', bcrypt.hashSync('admin123', 10), '安全审计员', 'security_auditor', '审计部', 'active');
  stmt.run('operator', bcrypt.hashSync('admin123', 10), '操作员', 'operator', '技术部', 'active');
  stmt.run('viewer', bcrypt.hashSync('admin123', 10), '只读用户', 'viewer', '业务部', 'active');
}

module.exports = { getDb };
