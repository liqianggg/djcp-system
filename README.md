# 等保测评全生命周期管理系统 v1.1

网络安全等级保护（DJCP）管理平台，覆盖信息系统定级、备案、差距分析、整改、测评的全生命周期。采用三权分立权限模型，仿 Apple 风格 UI。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite 8 + React Router 7 + Recharts + Lucide React |
| 后端 | Node.js + Express 5 + better-sqlite3 |
| 认证 | JWT + bcryptjs，支持 LDAP/AD 域控 |
| PDF 导出 | PDFKit + Arial Unicode 中文字体 |
| 文件处理 | multer (上传) + xlsx (Excel 导入) |
| 安全 | helmet + express-rate-limit + CORS |

## 快速开始

```bash
# 安装依赖
cd server && npm install
cd ../client && npm install

# 构建前端
cd client && npm run build

# 启动服务
cd ../server && npm start
```

| 服务 | 地址 | 说明 |
|------|------|------|
| 生产模式 | http://localhost:3001 | Express 托管前后端 |
| 前端开发 | http://localhost:5173 | Vite 热更新 |
| 后端 API | http://localhost:3001 | REST API |

## 默认账号（三权分立）

| 用户名 | 密码 | 角色 | 权限范围 |
|--------|------|------|----------|
| `sysadmin` | admin123 | 系统管理员 | 全部权限 |
| `secadmin` | admin123 | 安全管理员 | 业务 + 用户管理 |
| `auditor` | admin123 | 安全审计员 | 只读 + 审计日志 |
| `operator` | admin123 | 操作员 | 业务功能 |
| `viewer` | admin123 | 只读用户 | 仅查看 |

> ⚠️ **首次登录后请立即修改密码！**

## 功能模块

### 工作台
- 统计概览：系统总数、已定级、已备案、整改中数量
- 按安全等级分布图表
- 超期整改任务提醒

### 信息系统管理
- 6 种生命周期状态流转：draft → classified → filed → assessing → rectifying → completed
- 安全等级 L1-L5，系统类别 S1-S3 / G1-G3
- 增删改查 + 状态筛选

### 系统定级
- 依据 GB/T 22240-2020 定级矩阵 (S×G)
- 一键生成定级报告，支持 **HTML 预览** 和 **PDF 下载**（含中文字体）
- 报告包含：基本信息、定级结果、定级依据、定级矩阵、定级说明

### 备案管理
- 备案号、备案机关、备案日期、备案年份、审批状态
- 状态流转：preparing → submitted → approved → rejected
- **备案证明图片上传/预览/下载**
- 按年份和状态筛选

### 差距分析
- 差距项管理（物理/网络/主机/数据/应用/安全管理）
- 合规/不合规判定 + 风险等级 (高/中/低)
- **Excel 一键导入识别差距项**
- 自动计算合规率与总体评分

### 整改管理
- 任务优先级 (urgent/high/medium/low)
- 状态流转：pending → in_progress → completed → verified
- **整改证明截图上传与在线查看**
- 计划/实际日期跟踪，费用追踪

### 测评管理
- 测评类型：initial / reassessment / annual
- 测评机构从机构库下拉选择，自动关联
- 逐项评分：符合 / 部分符合 / 不符合 / 不适用
- 结论：pass / fail / conditional_pass

### 测评机构管理
- 机构库维护：名称、资质等级、资质编号及有效期、联系方式
- 机构对接人信息管理（姓名/电话/邮箱）
- 进场测评记录管理：进出场日期、测评人员、甲方对接人
- 机构与进场记录关联查询
- 增删改查 + 搜索筛选

### 文档管理
- 6 种文档类型：policy / procedure / record / report / evidence / other
- 关联信息系统，版本号管理
- 上传/下载/编辑/删除

### 用户管理
- 登录方式：本地认证 / LDAP 域控认证
- 三权分立角色体系
- 账号启停用、密码重置

### 权限管理
- 30+ 细粒度操作权限（如 `filing:create`）
- 按角色批量分配权限
- 前端路由 + 后端 API 双重校验

### 审计日志
- 全操作记录（含失败登录尝试）
- 按用户/操作/模块/时间范围筛选
- CSV 导出

### 系统管理
- **LDAP/AD 域控配置**：7 项参数，支持一键连接测试
- **文件上传路径配置**：可自定义存储位置
- 配置持久化存储

## 项目结构

```
djcp-system/
├── README.md
├── .gitignore
├── server/
│   ├── package.json
│   ├── djcp.db               # SQLite 数据库 (gitignore)
│   ├── uploads/               # 文件上传目录 (gitignore)
│   └── src/
│       ├── index.js           # Express 入口 (helmet/CORS/限流)
│       ├── database.js        # 表结构 + 种子数据 + 权限初始化
│       └── routes.js          # 全部 50+ API 路由
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── dist/                  # 构建产物
│   └── src/
│       ├── main.jsx
│       ├── App.jsx            # 路由/布局/认证/侧边栏
│       ├── api.js             # API 请求封装
│       ├── components.jsx     # 公共组件
│       └── pages/             # 12 个页面组件
│           ├── Dashboard.jsx          # 工作台
│           ├── Systems.jsx            # 信息系统
│           ├── Classification.jsx     # 系统定级 + 报告导出
│           ├── Filing.jsx             # 备案管理 + 证明上传
│           ├── GapAnalysis.jsx        # 差距分析 + Excel导入
│           ├── Rectification.jsx      # 整改管理 + 截图上传
│           ├── Assessment.jsx         # 测评管理
│           ├── AgencyManagement.jsx   # 测评机构管理 + 进场记录
│           ├── Documents.jsx          # 文档管理
│           ├── UserManagement.jsx     # 用户管理
│           ├── PermissionManagement.jsx # 权限管理
│           ├── AuditLog.jsx           # 审计日志
│           └── SystemSettings.jsx     # 系统管理 (LDAP/上传路径)
└── docs/
    ├── 需求文档.md            # 功能需求与业务规范
    ├── 设计文档.md            # 架构/数据库/API 设计
    └── 运维文档.md            # 部署/备份/故障排查
```

## API 概览

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 用户登录 |
| POST | `/api/logout` | 退出登录 |
| GET | `/api/me` | 获取当前用户信息 |

### 业务
| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/systems` | 信息系统列表/新增 |
| GET/PUT/DELETE | `/api/systems/:id` | 系统详情/编辑/删除 |
| GET/POST | `/api/classifications` | 定级列表/新增 |
| GET | `/api/classifications/:id/report` | 定级报告 (?format=html\|pdf) |
| GET/POST | `/api/filings` | 备案列表/新增 |
| PUT | `/api/filings/:id` | 编辑备案 |
| GET/POST/DELETE | `/api/filings/:id/evidences` | 备案证明管理 |
| GET | `/api/filings/:id/evidences/:eid/file` | 查看证明图片 |
| GET | `/api/filings/years` | 备案年份列表 |
| GET/POST | `/api/gap-analyses` | 差距分析列表/新增 |
| GET | `/api/gap-analyses/:id` | 差距分析详情(含差距项) |
| POST | `/api/gap-analyses/import` | Excel 导入差距项 |
| GET/POST | `/api/rectifications` | 整改列表/新增 |
| PUT | `/api/rectifications/:id` | 编辑整改 |
| POST | `/api/rectifications/:id/evidences` | 上传整改截图 |
| GET | `/api/rectifications/:id/evidences/:eid/file` | 查看截图 |
| GET/POST | `/api/assessments` | 测评列表/新增 |
| GET/POST | `/api/agencies` | 测评机构列表/新增 |
| PUT/DELETE | `/api/agencies/:id` | 编辑/删除机构 |
| GET | `/api/agencies/:id/records` | 机构进场记录列表 |
| POST | `/api/agencies/:id/records` | 新增进场记录 |
| PUT/DELETE | `/api/agencies/:id/records/:rid` | 编辑/删除进场记录 |
| GET/POST | `/api/documents` | 文档列表/上传 |
| PUT/DELETE | `/api/documents/:id` | 编辑/删除文档 |
| GET | `/api/documents/:id/download` | 下载文档 |

### 管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/users` | 用户列表/新增 |
| PUT/DELETE | `/api/users/:id` | 编辑/删除用户 |
| POST | `/api/users/:id/reset-password` | 重置密码 |
| GET/PUT | `/api/permissions` | 查看/修改角色权限 |
| GET | `/api/audit-logs` | 审计日志查询 |
| GET | `/api/audit-logs/export` | 审计日志导出 CSV |
| GET/PUT | `/api/settings` | 系统配置管理 |
| POST | `/api/settings/ldap/test` | LDAP 连接测试 |
| GET | `/api/dashboard/stats` | 工作台统计数据 |

## 文档

详见 `docs/` 目录：

- [需求文档](docs/需求文档.md) — 12 个功能模块需求规格
- [设计文档](docs/设计文档.md) — 架构/数据库/API/安全设计
- [运维文档](docs/运维文档.md) — 部署/备份/监控/故障排查
