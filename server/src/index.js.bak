const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
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

app.listen(PORT, () => {
  console.log(`DJCP 等保测评管理系统服务已启动: http://localhost:${PORT}`);
});
