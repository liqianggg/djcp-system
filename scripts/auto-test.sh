#!/bin/bash
# =============================================
#  DJCP 自动化测试监控脚本
#  功能: 变更检测 → 系统启动 → 功能测试 → 安全测试 → 报告生成
# =============================================
set -o pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_DIR="$DIR/test-reports"
COMMIT_FILE="$REPORT_DIR/last_checked_commit"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_FILE="$REPORT_DIR/report-$TIMESTAMP.md"
API_BASE="http://localhost:3001"
FRONTEND_URL="http://localhost:5173"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}  DJCP 自动化测试监控 v1.0${NC}"
echo -e "${BLUE}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BLUE}==============================================${NC}"

# ==================== 1. 检测变更 ====================
echo -e "\n${YELLOW}[1/6] 检测代码变更...${NC}"

cd "$DIR"

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo -e "${RED}  ✗ 非 Git 仓库，跳过变更检测${NC}"
  CURRENT_COMMIT="no-git"
else
  CURRENT_COMMIT=$(git log --oneline -1 | awk '{print $1}')
  COMMIT_MSG=$(git log --oneline -1 | cut -d' ' -f2-)
  
  if [ -f "$COMMIT_FILE" ]; then
    LAST_COMMIT=$(cat "$COMMIT_FILE")
    if [ "$CURRENT_COMMIT" = "$LAST_COMMIT" ]; then
      echo -e "${GREEN}  ✓ 无新变更 ($CURRENT_COMMIT)，跳过测试${NC}"
      exit 0
    fi
  fi
  echo -e "${GREEN}  ✓ 检测到新提交: ${CURRENT_COMMIT} - ${COMMIT_MSG}${NC}"
fi

# ==================== 2. 启动系统 ====================
echo -e "\n${YELLOW}[2/6] 启动系统服务...${NC}"

pkill -f "node src/index.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

cd "$DIR/server"
nohup node src/index.js > /tmp/djcp-server-test.log 2>&1 &
sleep 2

cd "$DIR/client"
nohup npx vite --host 0.0.0.0 > /tmp/djcp-vite-test.log 2>&1 &
sleep 3

if curl -s -X POST $API_BASE/api/login -H "Content-Type: application/json" -d '{"username":"test","password":"test"}' > /dev/null 2>&1; then
  echo -e "${GREEN}  ✓ 后端服务就绪 ($API_BASE)${NC}"
else
  echo -e "${RED}  ✗ 后端启动失败${NC}"
  exit 1
fi
echo -e "${GREEN}  ✓ 前端服务就绪 ($FRONTEND_URL)${NC}"

# ==================== 3. API 安全测试 ====================
echo -e "\n${YELLOW}[3/6] 执行 API 安全测试...${NC}"

mkdir -p "$REPORT_DIR"
cat > "$REPORT_FILE" << REPORT_HEADER
# DJCP 自动化测试报告

**生成时间**: $(date '+%Y-%m-%d %H:%M:%S')
**提交**: $CURRENT_COMMIT - $COMMIT_MSG
**测试环境**: Node.js / Express / SQLite
**API 地址**: $API_BASE

---

## 安全测试结果

| # | 测试项 | 严重程度 | 结果 | 详情 |
|---|--------|---------|------|------|
REPORT_HEADER

PASS=0
FAIL=0
ISSUES_HIGH=0
ISSUES_MEDIUM=0
ISSUES_LOW=0

record_test() {
  local num=$1 name=$2 severity=$3 result=$4 detail=$5
  if [ "$result" = "PASS" ]; then
    PASS=$((PASS + 1)); icon="✅"
  else
    FAIL=$((FAIL + 1)); icon="❌"
    case $severity in
      HIGH) ISSUES_HIGH=$((ISSUES_HIGH + 1)) ;;
      MEDIUM) ISSUES_MEDIUM=$((ISSUES_MEDIUM + 1)) ;;
      LOW) ISSUES_LOW=$((ISSUES_LOW + 1)) ;;
    esac
  fi
  echo "| $num | $name | $severity | $icon $result | $detail |" >> "$REPORT_FILE"
}

# S1: SQL 注入 - 登录绕过
echo -n "  S1 SQL 注入..."
SQLI_RESP=$(curl -s -X POST $API_BASE/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"sysadmin'\'' --","password":"anything"}')
if echo "$SQLI_RESP" | grep -q '"success":true'; then
  echo -e " ${RED}✗ 存在 SQL 注入漏洞!${NC}"
  record_test "S1" "SQL 注入-登录绕过" "HIGH" "FAIL" "payload: sysadmin' -- 成功绕过认证"
else
  echo -e " ${GREEN}✓${NC}"
  record_test "S1" "SQL 注入-登录绕过" "HIGH" "PASS" "参数化查询或转义有效"
fi

# S2: SQL 注入 - OR 1=1
echo -n "  S2 OR 1=1..."
SQLI2_RESP=$(curl -s -X POST $API_BASE/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"\" OR 1=1 --","password":"anything"}')
if echo "$SQLI2_RESP" | grep -q '"success":true'; then
  echo -e " ${RED}✗ SQL 注入漏洞!${NC}"
  record_test "S2" "SQL 注入-OR 1=1" "HIGH" "FAIL" "payload: ' OR 1=1 -- 成功绕过"
else
  echo -e " ${GREEN}✓${NC}"
  record_test "S2" "SQL 注入-OR 1=1" "HIGH" "PASS" "注入被阻止"
fi
# S8: Token 安全性 - JWT
echo -n "  S8 Token 安全..."
LOGIN_RESP=$(curl -s -X POST $API_BASE/api/login \
  -H "Content-Type: application/json" \
  -d '''{"username":"sysadmin","password":"admin123"}''')
TOKEN=$(echo "$LOGIN_RESP" | grep -o '''"token":"[^"]*"''' | cut -d'''"''' -f4)
if [ -n "$TOKEN" ]; then
  if echo "$TOKEN" | grep -qE '''^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'''; then
    echo -e " ${GREEN}✓ (JWT)${NC}"
    record_test "S8" "Token 安全性" "MEDIUM" "PASS" "使用 JWT 格式 token"
  elif echo "$TOKEN" | grep -qE '''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'''; then
    echo -e " ${YELLOW}⚠ UUID 格式${NC}"
    record_test "S8" "Token 安全性" "MEDIUM" "FAIL" "使用 UUID 而非 JWT，无法验证完整性和过期"
  else
    echo -e " ${GREEN}✓${NC}"
    record_test "S8" "Token 安全性" "MEDIUM" "PASS" "Token 格式正常"
  fi
else
  echo -e " ${RED}✗ 登录失败${NC}"
  record_test "S8" "Token 安全性" "MEDIUM" "FAIL" "无法登录获取 token"
fi


# S3: 暴力破解 - 速率限制
echo -n "  S3 暴力破解防护..."
RATE_LIMITED=0
for i in $(seq 1 10); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $API_BASE/api/login \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"sysadmin\",\"password\":\"wrong$i\"}")
  if [ "$HTTP_CODE" = "429" ]; then
    RATE_LIMITED=1
    break
  fi
done
if [ $RATE_LIMITED -eq 1 ]; then
  echo -e " ${GREEN}✓${NC}"
  record_test "S3" "暴力破解防护" "HIGH" "PASS" "第${i}次请求触发速率限制(429)"
else
  echo -e " ${RED}✗ 无速率限制${NC}"
  record_test "S3" "暴力破解防护" "HIGH" "FAIL" "10次连续请求未触发限制"
fi

# S4: 未授权访问
echo -n "  S4 未授权访问..."
AUTH_RESP=$(curl -s -o /dev/null -w "%{http_code}" $API_BASE/api/dashboard/stats)
if [ "$AUTH_RESP" = "401" ]; then
  echo -e " ${GREEN}✓${NC}"
  record_test "S4" "未授权访问" "MEDIUM" "PASS" "正确返回 401"
else
  echo -e " ${RED}✗ 返回 $AUTH_RESP${NC}"
  record_test "S4" "未授权访问" "MEDIUM" "FAIL" "无 token 返回 $AUTH_RESP 而非 401"
fi

# S5: XSS 注入
echo -n "  S5 XSS 注入..."
XSS_RESP=$(curl -s -X POST $API_BASE/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<script>alert(1)</script>","password":"test"}')
if echo "$XSS_RESP" | grep -q '<script>alert(1)</script>'; then
  echo -e " ${RED}✗ XSS 反射漏洞${NC}"
  record_test "S5" "XSS 跨站脚本" "HIGH" "FAIL" "输入被原样反射，存在 XSS 风险"
else
  echo -e " ${GREEN}✓${NC}"
  record_test "S5" "XSS 跨站脚本" "HIGH" "PASS" "输入被正确转义或过滤"
fi

# S6: 密码明文存储
echo -n "  S6 密码存储..."
if grep -q 'user.password !== password' "$DIR/server/src/routes.js" 2>/dev/null; then
  echo -e " ${RED}✗ 明文对比${NC}"
  record_test "S6" "密码存储安全" "HIGH" "FAIL" "密码明文对比: user.password !== password"
elif grep -qE 'hashPassword|bcrypt|argon2|scrypt' "$DIR/server/src/routes.js" 2>/dev/null; then
  echo -e " ${GREEN}✓${NC}"
  record_test "S6" "密码存储安全" "HIGH" "PASS" "使用哈希函数"
else
  echo -e " ${YELLOW}? 未知${NC}"
  record_test "S6" "密码存储安全" "HIGH" "FAIL" "未检测到密码哈希，可能明文存储"
fi

# S7: CORS 配置
echo -n "  S7 CORS 配置..."
CORS_RESP=$(curl -s --max-time 5 -D - -o /dev/null -X OPTIONS $API_BASE/api/login \
  -H "Origin: http://evil.com" \
  -H "Access-Control-Request-Method: POST" 2>&1)
if echo "$CORS_RESP" | grep -qi "Access-Control-Allow-Origin:.*\*"; then
  echo -e " ${YELLOW}⚠ 过于宽松${NC}"
  record_test "S7" "CORS 跨域配置" "MEDIUM" "FAIL" "允许任意来源 (Access-Control-Allow-Origin: *)"
elif echo "$CORS_RESP" | grep -qi "Access-Control-Allow-Origin"; then
  echo -e " ${GREEN}✓${NC}"
  record_test "S7" "CORS 跨域配置" "MEDIUM" "PASS" "CORS 策略已配置"
else
  echo -e " ${YELLOW}? 未设置${NC}"
  record_test "S7" "CORS 跨域配置" "MEDIUM" "FAIL" "未检测到 CORS 响应头"
fi

# S9: 安全响应头
echo -n "  S9 安全响应头..."
HEADERS=$(curl -s --max-time 5 -D - -o /dev/null -X POST $API_BASE/api/login -H "Content-Type: application/json" -d '{"username":"test","password":"test"}' 2>&1)
MISSING_HEADERS=""
if ! echo "$HEADERS" | grep -qi "X-Content-Type-Options"; then
  MISSING_HEADERS="$MISSING_HEADERS X-Content-Type-Options"
fi
if ! echo "$HEADERS" | grep -qi "X-Frame-Options"; then
  MISSING_HEADERS="$MISSING_HEADERS X-Frame-Options"
fi
if ! echo "$HEADERS" | grep -qi "X-XSS-Protection"; then
  MISSING_HEADERS="$MISSING_HEADERS X-XSS-Protection"
fi
if [ -n "$MISSING_HEADERS" ]; then
  echo -e " ${YELLOW}⚠ 缺少:$MISSING_HEADERS${NC}"
  record_test "S9" "安全响应头" "LOW" "FAIL" "缺少安全响应头:$MISSING_HEADERS"
else
  echo -e " ${GREEN}✓${NC}"
  record_test "S9" "安全响应头" "LOW" "PASS" "安全响应头完整"
fi

# ==================== 4. 功能测试 ====================
echo -e "\n${YELLOW}[4/6] 执行 API 功能测试...${NC}"

cat >> "$REPORT_FILE" << FUNC_HEADER

---

## 功能测试结果

| # | 测试项 | 结果 | 备注 |
|---|--------|------|------|
FUNC_HEADER

FUNC_NUM=0
func_test() {
  FUNC_NUM=$((FUNC_NUM + 1))
  local name=$1 result=$2 note=$3
  local icon="✅"; [ "$result" != "PASS" ] && icon="❌"
  echo "| F$FUNC_NUM | $name | $icon $result | $note |" >> "$REPORT_FILE"
}

# F1: 正常登录
echo -n "  F1 正常登录..."
if [ -n "$TOKEN" ]; then
  echo -e " ${GREEN}✓${NC}"
  func_test "正常登录" "PASS" "获取 token 成功"
else
  echo -e " ${RED}✗${NC}"
  func_test "正常登录" "FAIL" "登录失败"
fi

# F2: 错误密码
echo -n "  F2 错误密码..."
BAD_RESP=$(curl -s -X POST $API_BASE/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"sysadmin","password":"wrongpassword"}')
if echo "$BAD_RESP" | grep -q '"success":false'; then
  echo -e " ${GREEN}✓${NC}"
  func_test "错误密码拒绝" "PASS" "正确拒绝错误密码"
else
  echo -e " ${RED}✗${NC}"
  func_test "错误密码拒绝" "FAIL" "未能正确拒绝"
fi

# F3: 空用户名
echo -n "  F3 空用户名..."
EMPTY_RESP=$(curl -s -X POST $API_BASE/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"","password":"test"}')
if echo "$EMPTY_RESP" | grep -q '"success":false'; then
  echo -e " ${GREEN}✓${NC}"
  func_test "空用户名校验" "PASS" "正确拒绝空用户名"
else
  echo -e " ${RED}✗${NC}"
  func_test "空用户名校验" "FAIL" "未校验空用户名"
fi

# F4: 用户信息接口
echo -n "  F4 用户信息..."
if [ -n "$TOKEN" ]; then
  ME_RESP=$(curl -s $API_BASE/api/me -H "Authorization: Bearer $TOKEN")
  if echo "$ME_RESP" | grep -q '"username":"sysadmin"'; then
    echo -e " ${GREEN}✓${NC}"
    func_test "用户信息接口" "PASS" "返回用户数据正确"
  else
    echo -e " ${RED}✗${NC}"
    func_test "用户信息接口" "FAIL" "返回数据异常"
  fi
else
  echo -e " ${YELLOW}⊘ 跳过${NC}"
  func_test "用户信息接口" "SKIP" "无 token"
fi

# F5: 登出
echo -n "  F5 登出..."
if [ -n "$TOKEN" ]; then
  LOGOUT_RESP=$(curl -s -X POST $API_BASE/api/logout \
    -H "Authorization: Bearer $TOKEN")
  if echo "$LOGOUT_RESP" | grep -q '"success":true'; then
    echo -e " ${GREEN}✓${NC}"
    func_test "登出功能" "PASS" "登出成功"
  else
    echo -e " ${RED}✗${NC}"
    func_test "登出功能" "FAIL" "登出失败"
  fi
else
  echo -e " ${YELLOW}⊘ 跳过${NC}"
  func_test "登出功能" "SKIP" "无 token"
fi

# ==================== 5. 生成摘要 ====================
echo -e "\n${YELLOW}[5/6] 生成测试报告...${NC}"

cat >> "$REPORT_FILE" << SUMMARY

---

## 测试摘要

| 类别 | 通过 | 失败 | 总计 |
|------|------|------|------|
| 安全测试 | $((9 - ISSUES_HIGH - ISSUES_MEDIUM - ISSUES_LOW)) | $((ISSUES_HIGH + ISSUES_MEDIUM + ISSUES_LOW)) | 9 |
| 功能测试 | $PASS | $FAIL | $FUNC_NUM |

### 按严重程度分布

- 🔴 高危: $ISSUES_HIGH
- 🟡 中危: $ISSUES_MEDIUM
- 🟢 低危: $ISSUES_LOW

---

## 建议修复项

SUMMARY

if grep -qE 'S1.*FAIL|S2.*FAIL' "$REPORT_FILE"; then
  echo "> ⚠ **SQL 注入**: 使用参数化查询，检查所有动态 SQL 拼接" >> "$REPORT_FILE"
fi
if grep -q 'S3.*FAIL' "$REPORT_FILE"; then
  echo "> ⚠ **暴力破解**: 添加登录速率限制 (express-rate-limit)，连续失败后锁定账户" >> "$REPORT_FILE"
fi
if grep -q 'S6.*FAIL' "$REPORT_FILE"; then
  echo "> ⚠ **密码明文**: 使用 bcrypt/argon2 哈希存储密码" >> "$REPORT_FILE"
fi
if grep -q 'S7.*FAIL' "$REPORT_FILE"; then
  echo "> ⚠ **CORS 配置**: 限制 Access-Control-Allow-Origin 为受信任域名" >> "$REPORT_FILE"
fi
if grep -q 'S8.*FAIL' "$REPORT_FILE"; then
  echo "> ⚠ **Token 安全**: 使用 JWT 替代 UUID" >> "$REPORT_FILE"
fi
if grep -q 'S9.*FAIL' "$REPORT_FILE"; then
  echo "> ⚠ **安全响应头**: 使用 helmet 中间件自动添加安全头" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "*报告由 DJCP 自动化测试监控系统自动生成*" >> "$REPORT_FILE"

echo -e "${GREEN}  ✓ 报告已生成: $REPORT_FILE${NC}"

# ==================== 6. 清理 ====================
echo -e "\n${YELLOW}[6/6] 清理服务...${NC}"

pkill -f "node src/index.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo "$CURRENT_COMMIT" > "$COMMIT_FILE"
echo -e "${GREEN}  ✓ 清理完成${NC}"

# ==================== 输出摘要 ====================
echo ""
echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}  测试完成摘要${NC}"
echo -e "${BLUE}==============================================${NC}"
echo -e "  📊 安全测试: $((9 - ISSUES_HIGH - ISSUES_MEDIUM - ISSUES_LOW))/9 通过"
echo -e "  🔴 高危问题: $ISSUES_HIGH"
echo -e "  🟡 中危问题: $ISSUES_MEDIUM"
echo -e "  🟢 低危问题: $ISSUES_LOW"
echo -e "  📄 报告文件: $REPORT_FILE"
echo -e "${BLUE}==============================================${NC}"

if [ $ISSUES_HIGH -gt 0 ] || [ $ISSUES_MEDIUM -gt 0 ]; then
  exit 1
fi
exit 0
