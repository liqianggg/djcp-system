#!/bin/bash
echo "======================================="
echo "  等保测评全生命周期管理系统"
echo "  网络安全等级保护管理平台"
echo "======================================="
echo ""

DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill existing processes
pkill -f "node src/index.js" 2>/dev/null || true
sleep 1

# Start backend
echo "[1/2] 启动后端服务..."
cd "$DIR/server"
nohup node src/index.js > /tmp/djcp-server.log 2>&1 &
sleep 2

if curl -s http://localhost:3001/api/dashboard/stats > /dev/null 2>&1; then
  echo "  ✅ 后端服务启动成功 (http://localhost:3001)"
else
  echo "  ❌ 后端服务启动失败，请检查日志: /tmp/djcp-server.log"
  exit 1
fi

# Start frontend dev server
echo "[2/2] 启动前端开发服务器..."
cd "$DIR/client"
nohup npx vite --host 0.0.0.0 > /tmp/djcp-vite.log 2>&1 &
sleep 3

echo ""
echo "======================================="
echo "  🎉 系统已就绪！"
echo ""
echo "  前端开发: http://localhost:5173"
echo "  后端 API: http://localhost:3001"
echo ""
echo "  默认账号: admin"
echo "  默认密码: admin123"
echo "======================================="
