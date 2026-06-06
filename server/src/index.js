const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const routes = require('./routes');
const { initDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// 安全响应头
app.use(helmet());

// CORS - 限制为受信任来源
app.use(cors({
  origin: process.env.CORS_ORIGIN || function(origin, callback) {
    // Allow localhost on any port in development
    if (!origin || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 全局速率限制
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: '请求过于频繁，请稍后再试' }
});
app.use(globalLimiter);

// 登录接口速率限制
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { success: false, message: '登录尝试过于频繁，请15分钟后再试' }
});
app.use('/api/login', loginLimiter);

app.use(express.json());
app.use(routes);

// 静态文件服务（前端构建产物）
const distPath = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(distPath));

// SPA fallback
app.get('/*splat', (req, res) => {
  if (!req.path.startsWith('/api')) {
    const indexPath = path.join(distPath, 'index.html');
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).json({ message: 'DJCP API Server Running' });
    }
  }
});

// 初始化数据库后启动服务
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`DJCP 等保测评管理系统服务已启动: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
