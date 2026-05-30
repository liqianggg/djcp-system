# 等保测评全生命周期管理系统

网络安全等级保护（DJCP）管理平台，覆盖信息系统定级、备案、差距分析、整改、测评的全生命周期。采用三权分立权限模型。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite 8 + React Router 7 |
| 后端 | Node.js + Express 5 |
| 数据库 | SQLite (better-sqlite3) |
| 认证 | JWT + Session 双模式，支持 LDAP/AD 域控 |
| 图表 | Recharts |
| 图标 | Lucide React |

## 快速开始

```bash
# 安装依赖
cd server && npm install
cd ../client && npm install

# 启动服务
cd .. && ./start.sh
```

| 服务 | 地址 |
|------|------|
| 前端开发 | http://localhost:5173 |
| 后端 API | http://localhost:3001 |

## 默认账号（三权分立）

| 账号 | 密码 | 角色 |
|------|------|------|
| sysadmin | admin123 | 系统管理员 |
| secadmin | admin123 | 安全管理员 |
| auditor | admin123 | 安全审计员 |
| operator | admin123 | 操作员 |
| viewer | admin123 | 只读用户 |

## 功能模块

### 工作台
- 系统总数、文档数、整改任务数、测评数概览
- 超期整改任务提醒

### 信息系统管理
- 6 种生命周期状态：draft → classified → filed → assessing → rectifying → completed
- 安全等级 L1-L5 / 类别 S1-S3, G1-G3

### 系统定级
- 依据 GB/T 22240-2020 定级矩阵
- 一键生成 HTML 定级报告（含 S×G 矩阵，当前等级高亮）

### 备案管理
- 备案号、备案机关、提交/审批状态管理

### 差距分析
- 差距项管理（物理/网络/主机/数据/应用/安全管理）
- 合规/不合规判定 + 风险等级

### 整改管理
- 任务优先级、状态流转（待处理→进行中→已完成→已验证）
- 整改截图上传（支持多图，`<img>` 标签免认证查看）
- 费用追踪

### 测评管理
- 测评机构、测评类型
- 逐项评分（符合/部分符合/不符合/不适用）
- 结论：通过 / 有条件通过 / 未通过

### 文档管理
- 6 种文档类型：管理制度/操作规程/记录表单/测评报告/整改证据/其他
- 关联信息系统，上传人自动绑定登录用户

### 用户管理
- 登录方式：本地认证 / 域控认证（LDAP/AD）
- 三权分立角色体系
- 账号启停用

### 权限管理
- 30+ 细粒度权限，按角色分配
- 权限模块：仪表盘、系统、定级、备案、差距、整改、测评、文档、用户、审计

### 审计日志
- 全操作记录（登录、创建、修改、删除、状态变更）
- 支持按用户/操作/模块/时间筛选
- CSV 导出

### LDAP/AD 域控
- 7 项配置参数（服务器、端口、域名、管理员等）
- 启用/禁用开关
- 用户级 `login_type` 切换
- 连接异常友好提示

## 项目结构

```
djcp-system/
├── start.sh              # 一键启动脚本
├── README.md
├── server/
│   ├── package.json
│   ├── djcp.db            # SQLite 数据库
│   ├── uploads/           # 文件上传目录
│   └── src/
│       ├── index.js       # 入口，Express 配置
│       ├── database.js    # 数据库初始化 & 种子数据
│       └── routes.js      # 全部 API 路由
└── client/
    ├── package.json
    ├── vite.config.js     # Vite 配置 + API 代理
    ├── index.html
    ├── dist/              # 构建产物
    └── src/
        ├── main.jsx       # React 入口
        ├── App.jsx        # 路由、布局、登录页
        ├── api.js         # API 请求封装
        ├── index.css      # 全局样式
        ├── components.jsx # 公共组件
        └── pages/
            ├── Dashboard.jsx          # 工作台
            ├── Systems.jsx            # 信息系统
            ├── Classification.jsx     # 系统定级
            ├── Filing.jsx             # 备案管理
            ├── GapAnalysis.jsx        # 差距分析
            ├── Rectification.jsx      # 整改管理
            ├── Assessment.jsx         # 测评管理
            ├── Documents.jsx          # 文档管理
            ├── UserManagement.jsx     # 用户管理
            ├── PermissionManagement.jsx # 权限管理
            └── AuditLog.jsx           # 审计日志
```

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/login | 登录认证 |
| POST | /api/logout | 登出 |
| GET | /api/me | 当前用户信息 |
| GET | /api/dashboard/stats | 工作台统计 |
| GET/POST | /api/systems | 信息系统 CRUD |
| GET/POST | /api/classifications | 系统定级 |
| GET | /api/classifications/:id/report | 定级报告 |
| GET/POST/PUT | /api/filings | 备案管理 |
| GET/POST | /api/gap-analyses | 差距分析 |
| GET/POST/PUT/DELETE | /api/rectifications | 整改任务 |
| POST | /api/rectifications/:id/evidences | 上传整改截图 |
| GET | /api/rectifications/:id/evidences/:eid/file | 查看截图 |
| GET/POST | /api/assessments | 测评管理 |
| GET/POST/PUT/DELETE | /api/documents | 文档管理 |
| GET | /api/documents/:id/download | 下载文档 |
| GET/POST/PUT/DELETE | /api/users | 用户管理 |
| GET/PUT | /api/permissions | 权限管理 |
| GET | /api/audit-logs | 审计日志 |
| GET/PUT | /api/settings | LDAP 配置 |
