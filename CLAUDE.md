# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
# 安装依赖
cd server && npm install
cd ../client && npm install

# 启动后端 (Express API, port 3001)
cd server && npm start          # 生产模式
cd server && npm run dev        # 开发模式 (node --watch, 文件变更自动重启)

# 启动前端 (Vite 热更新, port 5173)
cd client && npm run dev

# 构建前端 (输出到 client/dist)
cd client && npm run build
```

生产模式下 Express 直接托管 `client/dist` 静态文件，访问 `http://localhost:3001` 即可。开发时分别启动前后端，Vite 将 `/api` 请求代理到后端。

## 架构概览

### 后端 (server/)

两个核心文件承载了全部业务逻辑：

- **`server/src/database.js`** — 数据库初始化。使用 **sql.js**（编译到 WebAssembly 的 SQLite）而非 better-sqlite3。关键细节：`wrapDb()` 将 sql.js 的底层 API 包装成 `prepare().run()/get()/all()` 风格，每次写操作后自动调用 `save()` 将数据库序列化写入文件。表结构、种子数据、三权分立角色和 30+ 细粒度权限均在此初始化。`ALTER TABLE` 错误被静默忽略，用作轻量级 migration 机制。

- **`server/src/routes.js`** — 全部 50+ API 路由的单文件（1444 行）。认证模式：`requirePermission(...permCodes)` 中间件先尝试验证 JWT，失败后回退到 sessions 表查询 token。权限通过 `role_permissions` 表关联角色与权限码（如 `filing:create`），前端路由和后端 API 双向校验。

- `server/src/index.js` — Express 入口，挂载 helmet、CORS、限流（全局 500/15min + 登录 10/15min），初始化数据库后启动。

### 前端 (client/)

- **`client/src/App.jsx`** — 应用根组件，包含登录页、侧边栏导航、路由定义、权限过滤。token 和用户信息存入 `localStorage`（key: `djcp_token` / `djcp_user`），页面路由通过 `permMap` 映射到细粒度权限码，无权限时重定向。

- **`client/src/api.js`** — 请求封装层。`apiGet/apiPost/apiPut/apiDelete/apiUpload` 统一附加 Authorization header，401 时自动清除 localStorage 并刷新页面。

- **`client/src/pages/`** — 13 个页面组件，每个对应一个功能模块：`Dashboard`, `Systems`, `Classification`, `Filing`, `GapAnalysis`, `Rectification`, `Assessment`, `AgencyManagement`, `Documents`, `UserManagement`, `PermissionManagement`, `AuditLog`, `SystemSettings`。

### 数据库

SQLite 单文件 `server/djcp.db`（gitignore）。使用 WAL 模式。关键表：`systems`（6 种生命周期状态）、`users`（5 种角色）、`classifications`、`filings`、`gap_analyses` + `gap_items`、`rectifications`、`assessments` + `assessment_items`、`assessment_agencies` + `on_site_records`、`documents`、`audit_logs`、`sessions`、`permissions` + `role_permissions`、`settings`。

### 认证与权限

- 登录支持本地密码（bcrypt 10 轮）和 LDAP/AD 域控认证。域控用户首次登录自动在本地创建账号。
- JWT（24h 过期）+ sessions 表双通道。`requirePermission()` 兼容两种方式。
- 五角色三权分立：`system_admin`（全部权限）、`security_admin`（业务+用户管理）、`security_auditor`（只读+审计）、`operator`（业务功能）、`viewer`（只读）。
