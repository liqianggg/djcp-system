#!/bin/bash
# =============================================
#  DJCP 全覆盖功能测试脚本
#  基于需求文档 REQ-001 ~ REQ-012
# =============================================
set -o pipefail

API_BASE="${API_BASE:-http://localhost:3001}"
TOKEN=""
REPORT_FILE="${REPORT_FILE:-/dev/stdout}"
PASS=0; FAIL=0; SKIP=0
TEST_RESOURCES=()  # track created IDs for cleanup

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

# 登录获取 token
login() {
  local resp=$(curl -s -X POST "$API_BASE/api/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"sysadmin","password":"admin123"}')
  TOKEN=$(echo "$resp" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  if [ -z "$TOKEN" ]; then
    echo "FATAL: 无法登录" >&2
    exit 1
  fi
}

# API 请求辅助函数
api_get() { curl -s --max-time 10 -H "Authorization: Bearer $TOKEN" "$API_BASE$1"; }
api_post() { curl -s --max-time 10 -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2" "$API_BASE$1"; }
api_put() { curl -s --max-time 10 -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2" "$API_BASE$1"; }
api_delete() { curl -s --max-time 10 -X DELETE -H "Authorization: Bearer $TOKEN" "$API_BASE$1"; }
api_post_file() {
  curl -s --max-time 10 -X POST -H "Authorization: Bearer $TOKEN" -F "file=@$2" "$API_BASE$1"
}

# 测试记录
test_pass() { PASS=$((PASS+1)); echo "| $1 | $2 | ✅ PASS | $3 |" >> "$REPORT_FILE"; }
test_fail() { FAIL=$((FAIL+1)); echo "| $1 | $2 | ❌ FAIL | $3 |" >> "$REPORT_FILE"; }

# 报告头
report_header() {
  cat > "$REPORT_FILE" << HEADER
# DJCP 全覆盖功能测试报告

**生成时间**: $(date '+%Y-%m-%d %H:%M:%S')
**API 地址**: $API_BASE

---

## 功能测试结果（按需求模块）

| 需求 | 测试项 | 结果 | 备注 |
|------|--------|------|------|
HEADER
}

report_footer() {
  local total=$((PASS + FAIL))
  cat >> "$REPORT_FILE" << FOOTER

---

## 功能测试摘要

| 通过 | 失败 | 总计 | 通过率 |
|------|------|------|--------|
| $PASS | $FAIL | $total | $(awk "BEGIN {printf \"%.1f%%\", ($PASS/$total)*100}") |

*报告由 DJCP 全覆盖功能测试自动生成*
FOOTER
}

# ==================== 登录 ====================
login

# ==================== REQ-001: 工作台 ====================
echo -e "\n${BLUE}═══ REQ-001 工作台 Dashboard ═══${NC}"

echo -n "  F01 仪表盘统计..."
RESP=$(api_get "/api/dashboard/stats")
if echo "$RESP" | grep -q '"totalSystems"'; then
  echo -e " ${GREEN}✓${NC}"; test_pass "REQ-001" "仪表盘统计" "返回 totalSystems 等指标"
else
  echo -e " ${RED}✗${NC}"; test_fail "REQ-001" "仪表盘统计" "响应异常"
fi

echo -n "  F02 等级分布..."
if echo "$RESP" | grep -q '"levelDistribution"'; then
  echo -e " ${GREEN}✓${NC}"; test_pass "REQ-001" "等级分布" "包含 levelDistribution"
else
  echo -e " ${RED}✗${NC}"; test_fail "REQ-001" "等级分布" "缺少等级分布数据"
fi

echo -n "  F03 最近操作..."
if echo "$RESP" | grep -q '"recentActivities"'; then
  echo -e " ${GREEN}✓${NC}"; test_pass "REQ-001" "最近操作" "包含 recentActivities"
else
  echo -e " ${RED}✗${NC}"; test_fail "REQ-001" "最近操作" "缺少最近操作记录"
fi

# ==================== REQ-002: 信息系统管理 ====================
echo -e "\n${BLUE}═══ REQ-002 信息系统管理 ═══${NC}"

echo -n "  F04 系统列表..."
RESP=$(api_get "/api/systems")
if echo "$RESP" | grep -q '\[{'; then
  echo -e " ${GREEN}✓${NC}"; test_pass "REQ-002" "系统列表查询" "返回数组"
else
  echo -e " ${RED}✗${NC}"; test_fail "REQ-002" "系统列表查询" "返回异常"
fi

echo -n "  F05 新增系统..."
RESP=$(api_post "/api/systems" '{"name":"自动化测试系统","code":"AUTO-TEST-001","department":"测试部门","category":"S2","description":"功能测试创建","security_level":3}')
SYS_ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
if [ -n "$SYS_ID" ]; then
  echo -e " ${GREEN}✓${NC} (id=$SYS_ID)"; test_pass "REQ-002" "新增信息系统" "创建成功 id=$SYS_ID"
  TEST_RESOURCES+=("systems:$SYS_ID")
else
  echo -e " ${RED}✗${NC}"; test_fail "REQ-002" "新增信息系统" "创建失败"
fi

if [ -n "$SYS_ID" ]; then
  echo -n "  F06 系统详情..."
  RESP=$(api_get "/api/systems/$SYS_ID")
  if echo "$RESP" | grep -q '"name":"自动化测试系统"'; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-002" "系统详情查询" "数据正确"
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-002" "系统详情查询" "数据异常"
  fi

  echo -n "  F07 编辑系统..."
  RESP=$(api_put "/api/systems/$SYS_ID" '{"name":"自动化测试系统(已编辑)","department":"更新部门"}')
  if echo "$RESP" | grep -q '"success":true'; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-002" "编辑信息系统" "修改成功"
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-002" "编辑信息系统" "修改失败"
  fi

  echo -n "  F08 状态流转..."
  STATUS=$(echo "$RESP" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  if [ -n "$STATUS" ]; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-002" "系统状态" "当前状态: $STATUS"
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-002" "系统状态" "无法获取状态"
  fi
fi

# ==================== REQ-003: 定级管理 ====================
echo -e "\n${BLUE}═══ REQ-003 系统定级管理 ═══${NC}"

if [ -n "$SYS_ID" ]; then
  echo -n "  F09 创建定级..."
  RESP=$(api_post "/api/classifications" "{\"system_id\":$SYS_ID,\"business_impact_level\":3,\"service_scope\":\"全国范围\",\"business_dependency\":\"核心业务依赖网络\",\"classification_basis\":\"依据GB/T 22240-2020定级指南\"}")
  CLS_ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  if [ -n "$CLS_ID" ]; then
    echo -e " ${GREEN}✓${NC} (id=$CLS_ID)"; test_pass "REQ-003" "创建定级记录" "成功 id=$CLS_ID"
    TEST_RESOURCES+=("classifications:$CLS_ID")
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-003" "创建定级记录" "失败"
  fi

  echo -n "  F10 定级列表..."
  RESP=$(api_get "/api/classifications")
  if echo "$RESP" | grep -q '\[{'; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-003" "定级列表查询" "返回数据"
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-003" "定级列表查询" "返回异常"
  fi

  if [ -n "$CLS_ID" ]; then
    echo -n "  F11 定级报告查询..."
    RESP=$(api_get "/api/classifications/$CLS_ID/report")
    if echo "$RESP" | grep -q '"report"'; then
      echo -e " ${GREEN}✓${NC}"; test_pass "REQ-003" "定级报告查询" "包含 report 字段"
    else
      echo -e " ${YELLOW}⚠${NC}"; test_fail "REQ-003" "定级报告查询" "响应异常"
    fi

    echo -n "  F12 定级报告PDF..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 -H "Authorization: Bearer $TOKEN" "$API_BASE/api/classifications/$CLS_ID/report?format=pdf")
    if [ "$HTTP_CODE" = "200" ]; then
      echo -e " ${GREEN}✓${NC}"; test_pass "REQ-003" "定级报告PDF导出" "HTTP 200"
    else
      echo -e " ${YELLOW}⚠${NC}"; test_fail "REQ-003" "定级报告PDF导出" "HTTP $HTTP_CODE"
    fi
  fi
fi

# ==================== REQ-004: 备案管理 ====================
echo -e "\n${BLUE}═══ REQ-004 备案管理 ═══${NC}"

if [ -n "$SYS_ID" ]; then
  echo -n "  F13 创建备案..."
  RESP=$(api_post "/api/filings" "{\"system_id\":$SYS_ID,\"filing_number\":\"京A2026-001\",\"filing_agency\":\"北京市公安局网安总队\",\"filing_date\":\"2026-05-31\",\"filing_year\":\"2026\",\"status\":\"preparing\"}")
  FILING_ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  if [ -n "$FILING_ID" ]; then
    echo -e " ${GREEN}✓${NC} (id=$FILING_ID)"; test_pass "REQ-004" "创建备案记录" "成功 id=$FILING_ID"
    TEST_RESOURCES+=("filings:$FILING_ID")
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-004" "创建备案记录" "失败"
  fi

  echo -n "  F14 备案列表..."
  RESP=$(api_get "/api/filings")
  if echo "$RESP" | grep -q '\[{'; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-004" "备案列表查询" "返回数据"
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-004" "备案列表查询" "返回异常"
  fi

  echo -n "  F15 按年份筛选..."
  RESP=$(api_get "/api/filings?year=2026")
  if echo "$RESP" | grep -q '\[{'; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-004" "按年份筛选备案" "筛选正常"
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-004" "按年份筛选备案" "筛选异常"
  fi

  if [ -n "$FILING_ID" ]; then
    echo -n "  F16 编辑备案..."
    RESP=$(api_put "/api/filings/$FILING_ID" '{"status":"submitted"}')
    if echo "$RESP" | grep -q '"success":true'; then
      echo -e " ${GREEN}✓${NC}"; test_pass "REQ-004" "编辑备案状态" "状态已更新"
    else
      echo -e " ${RED}✗${NC}"; test_fail "REQ-004" "编辑备案状态" "更新失败"
    fi

    # 上传备案证明
    echo -n "  F17 上传备案证明..."
    echo "test evidence" > /tmp/djcp-test-evidence.txt
    RESP=$(api_post_file "/api/filings/$FILING_ID/evidences" "/tmp/djcp-test-evidence.txt")
    if echo "$RESP" | grep -q '"success":true'; then
      echo -e " ${GREEN}✓${NC}"; test_pass "REQ-004" "上传备案证明" "上传成功"
    else
      echo -e " ${YELLOW}⚠${NC}"; test_fail "REQ-004" "上传备案证明" "上传失败"
    fi

    echo -n "  F18 备案证明列表..."
    RESP=$(api_get "/api/filings/$FILING_ID/evidences")
    if echo "$RESP" | grep -q '\[{'; then
      echo -e " ${GREEN}✓${NC}"; test_pass "REQ-004" "备案证明列表" "返回证明数据"
    else
      echo -e " ${RED}✗${NC}"; test_fail "REQ-004" "备案证明列表" "无证明数据"
    fi

    # 获取证明 ID 用于下载
    EVID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
    if [ -n "$EVID" ]; then
      echo -n "  F19 备案证明下载..."
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $TOKEN" "$API_BASE/api/filings/$FILING_ID/evidences/$EVID/file")
      if [ "$HTTP_CODE" = "200" ]; then
        echo -e " ${GREEN}✓${NC}"; test_pass "REQ-004" "备案证明下载" "HTTP 200"
      else
        echo -e " ${YELLOW}⚠${NC}"; test_fail "REQ-004" "备案证明下载" "HTTP $HTTP_CODE"
      fi
    fi
  fi
fi

# ==================== REQ-005: 差距分析 ====================
echo -e "\n${BLUE}═══ REQ-005 差距分析 ═══${NC}"

if [ -n "$SYS_ID" ]; then
  echo -n "  F20 创建差距分析..."
  RESP=$(api_post "/api/gap-analyses" "{\"system_id\":$SYS_ID,\"analysis_date\":\"2026-05-31\"}")
  GAP_ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  if [ -n "$GAP_ID" ]; then
    echo -e " ${GREEN}✓${NC} (id=$GAP_ID)"; test_pass "REQ-005" "创建差距分析" "成功 id=$GAP_ID"
    TEST_RESOURCES+=("gap-analyses:$GAP_ID")
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-005" "创建差距分析" "失败"
  fi

  echo -n "  F21 差距分析列表..."
  RESP=$(api_get "/api/gap-analyses")
  if echo "$RESP" | grep -q '\[{'; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-005" "差距分析列表" "返回数据"
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-005" "差距分析列表" "返回异常"
  fi

  if [ -n "$GAP_ID" ]; then
    echo -n "  F22 差距分析详情..."
    RESP=$(api_get "/api/gap-analyses/$GAP_ID")
    if echo "$RESP" | grep -q '"system_id"'; then
      echo -e " ${GREEN}✓${NC}"; test_pass "REQ-005" "差距分析详情" "数据正确"
    else
      echo -e " ${RED}✗${NC}"; test_fail "REQ-005" "差距分析详情" "数据异常"
    fi
  echo -n "  F22b 导入Excel差距项..."
  echo "category,control_id,control_desc,expected_value,actual_value,compliance_status,risk_level" > /tmp/djcp-test-gap.csv
  echo "物理安全,PHY-001,机房门禁,门禁系统,无门禁,non_compliant,high" >> /tmp/djcp-test-gap.csv
  RESP=$(curl -s --max-time 10 -X POST -H "Authorization: Bearer $TOKEN" -F "file=@/tmp/djcp-test-gap.csv" "$API_BASE/api/gap-analyses/import")
  if echo "$RESP" | grep -q '"success":true'; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-005" "导入Excel差距项" "导入成功"
  else
    echo -e " ${YELLOW}⚠${NC}"; test_fail "REQ-005" "导入Excel差距项" "导入失败"
  fi
  rm -f /tmp/djcp-test-gap.csv

  fi
fi

# ==================== REQ-006: 整改管理 ====================
echo -e "\n${BLUE}═══ REQ-006 整改管理 ═══${NC}"

if [ -n "$SYS_ID" ]; then
  echo -n "  F23 创建整改任务..."
  RESP=$(api_post "/api/rectifications" "{\"system_id\":$SYS_ID,\"title\":\"自动化测试整改项\",\"description\":\"功能测试创建的整改任务\",\"responsible_person\":\"测试员\",\"priority\":\"high\",\"planned_date\":\"2026-06-15\"}")
  RECT_ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  if [ -n "$RECT_ID" ]; then
    echo -e " ${GREEN}✓${NC} (id=$RECT_ID)"; test_pass "REQ-006" "创建整改任务" "成功 id=$RECT_ID"
    TEST_RESOURCES+=("rectifications:$RECT_ID")
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-006" "创建整改任务" "失败"
  fi

  echo -n "  F24 整改列表..."
  RESP=$(api_get "/api/rectifications")
  if echo "$RESP" | grep -q '\[{'; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-006" "整改列表查询" "返回数据"
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-006" "整改列表查询" "返回异常"
  fi

  if [ -n "$RECT_ID" ]; then
    echo -n "  F25 编辑整改状态..."
    RESP=$(api_put "/api/rectifications/$RECT_ID" '{"status":"in_progress"}')
    if echo "$RESP" | grep -q '"success":true'; then
      echo -e " ${GREEN}✓${NC}"; test_pass "REQ-006" "更新整改状态" "状态已更新"
    else
      echo -e " ${RED}✗${NC}"; test_fail "REQ-006" "更新整改状态" "更新失败"
    fi

    echo -n "  F26 上传整改证明..."
    RESP=$(api_post_file "/api/rectifications/$RECT_ID/evidences" "/tmp/djcp-test-evidence.txt")
    if echo "$RESP" | grep -q '"success":true'; then
      echo -e " ${GREEN}✓${NC}"; test_pass "REQ-006" "上传整改证明" "上传成功"
    else
      echo -e " ${YELLOW}⚠${NC}"; test_fail "REQ-006" "上传整改证明" "上传失败"
    fi

    echo -n "  F27 整改证明列表..."
    RESP=$(api_get "/api/rectifications/$RECT_ID/evidences")
    if echo "$RESP" | grep -q '\[{'; then
      echo -e " ${GREEN}✓${NC}"; test_pass "REQ-006" "整改证明列表" "返回证明数据"
    else
      echo -e " ${RED}✗${NC}"; test_fail "REQ-006" "整改证明列表" "无证明数据"
    fi
  fi
fi

# ==================== REQ-007: 测评管理 ====================
echo -e "\n${BLUE}═══ REQ-007 测评管理 ═══${NC}"

if [ -n "$SYS_ID" ]; then
  echo -n "  F28 创建测评记录..."
  RESP=$(api_post "/api/assessments" "{\"system_id\":$SYS_ID,\"agency_name\":\"测试测评机构\",\"assessment_type\":\"initial\",\"assessment_date\":\"2026-05-31\",\"report_number\":\"CP-2026-001\"}")
  ASSESS_ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  if [ -n "$ASSESS_ID" ]; then
    echo -e " ${GREEN}✓${NC} (id=$ASSESS_ID)"; test_pass "REQ-007" "创建测评记录" "成功 id=$ASSESS_ID"
    TEST_RESOURCES+=("assessments:$ASSESS_ID")
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-007" "创建测评记录" "失败"
  fi

  echo -n "  F29 测评列表..."
  RESP=$(api_get "/api/assessments")
  if echo "$RESP" | grep -q '\[{'; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-007" "测评列表查询" "返回数据"
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-007" "测评列表查询" "返回异常"
  fi
  echo -n "  F28b 创建测评(含项目+结论)..."
  RESP=$(api_post "/api/assessments" '{"system_id":'$SYS_ID',"assessment_agency":"测试测评机构","assessment_type":"initial","assessment_date":"2026-05-31","overall_score":85.5,"overall_level":"良","conclusion":"pass","report_number":"CP-2026-002","items":[{"category":"物理安全","control_id":"PHY-001","control_desc":"机房门禁控制","score":8,"max_score":10,"result":"符合"},{"category":"网络安全","control_id":"NET-001","control_desc":"防火墙策略","score":7,"max_score":10,"result":"部分符合"}]}')
  ASSESS2_ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  if [ -n "$ASSESS2_ID" ]; then
    echo -e " ${GREEN}✓${NC} (id=$ASSESS2_ID)"; test_pass "REQ-007" "创建测评(含项目+结论)" "成功 id=$ASSESS2_ID"
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-007" "创建测评(含项目+结论)" "失败"
  fi

fi

# ==================== REQ-008: 文档管理 ====================
echo -e "\n${BLUE}═══ REQ-008 文档管理 ═══${NC}"

if [ -n "$SYS_ID" ]; then
  echo -n "  F30 上传文档..."
  RESP=$(api_post_file "/api/documents" "/tmp/djcp-test-evidence.txt")
  DOC_ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  # documents upload may need additional fields, try with JSON
  if [ -z "$DOC_ID" ]; then
    RESP=$(api_post "/api/documents" "{\"system_id\":$SYS_ID,\"title\":\"测试文档\",\"doc_type\":\"record\",\"version\":\"1.0\",\"description\":\"功能测试文档\"}")
    DOC_ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  fi
  if [ -n "$DOC_ID" ]; then
    echo -e " ${GREEN}✓${NC} (id=$DOC_ID)"; test_pass "REQ-008" "上传/创建文档" "成功 id=$DOC_ID"
    TEST_RESOURCES+=("documents:$DOC_ID")
  else
    echo -e " ${YELLOW}⚠${NC}"; test_fail "REQ-008" "上传/创建文档" "失败"
  fi

  echo -n "  F31 文档列表..."
  RESP=$(api_get "/api/documents")
  if echo "$RESP" | grep -q '\[{'; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-008" "文档列表查询" "返回数据"
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-008" "文档列表查询" "返回异常"
  fi

  if [ -n "$DOC_ID" ]; then
    echo -n "  F32 编辑文档..."
    RESP=$(api_put "/api/documents/$DOC_ID" '{"title":"测试文档(已编辑)","version":"2.0"}')
    if echo "$RESP" | grep -q '"success":true'; then
      echo -e " ${GREEN}✓${NC}"; test_pass "REQ-008" "编辑文档" "编辑成功"
    else
      echo -e " ${RED}✗${NC}"; test_fail "REQ-008" "编辑文档" "编辑失败"
    fi

    echo -n "  F33 文档下载..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $TOKEN" "$API_BASE/api/documents/$DOC_ID/download")
    if [ "$HTTP_CODE" = "200" ]; then
      echo -e " ${GREEN}✓${NC}"; test_pass "REQ-008" "文档下载" "HTTP 200"
    else
      echo -e " ${YELLOW}⚠${NC}"; test_fail "REQ-008" "文档下载" "HTTP $HTTP_CODE"
    fi
  fi
fi

# ==================== REQ-009: 用户与权限管理 ====================
echo -e "\n${BLUE}═══ REQ-009 用户与权限管理 ═══${NC}"

echo -n "  F34 用户列表..."
RESP=$(api_get "/api/users")
if echo "$RESP" | grep -q '\[{'; then
  echo -e " ${GREEN}✓${NC}"; test_pass "REQ-009" "用户列表查询" "返回数据"
else
  echo -e " ${RED}✗${NC}"; test_fail "REQ-009" "用户列表查询" "返回异常"
fi

echo -n "  F35 活跃用户列表..."
RESP=$(api_get "/api/users/active")
if echo "$RESP" | grep -q '\[{'; then
  echo -e " ${GREEN}✓${NC}"; test_pass "REQ-009" "活跃用户查询" "返回数据"
else
  echo -e " ${RED}✗${NC}"; test_fail "REQ-009" "活跃用户查询" "返回异常"
fi

echo -n "  F36 创建用户..."
RESP=$(api_post "/api/users" '{"username":"autotest","password":"Test123456","real_name":"自动化测试员","role":"operator","department":"测试部门","login_type":"local"}')
USER_ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
if [ -n "$USER_ID" ]; then
  echo -e " ${GREEN}✓${NC} (id=$USER_ID)"; test_pass "REQ-009" "创建用户" "成功 id=$USER_ID"
  TEST_RESOURCES+=("users:$USER_ID")
else
  echo -e " ${RED}✗${NC}"; test_fail "REQ-009" "创建用户" "失败"
fi

if [ -n "$USER_ID" ]; then
  echo -n "  F37 编辑用户..."
  RESP=$(api_put "/api/users/$USER_ID" '{"real_name":"自动化测试员(已编辑)","department":"新部门"}')
  if echo "$RESP" | grep -q '"success":true'; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-009" "编辑用户" "编辑成功"
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-009" "编辑用户" "编辑失败"
  fi

  echo -n "  F38 重置密码..."
  RESP=$(api_post "/api/users/$USER_ID/reset-password" '{"new_password":"NewPass123456"}')
  if echo "$RESP" | grep -q '"success":true'; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-009" "重置用户密码" "重置成功"
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-009" "重置用户密码" "重置失败"
  fi
  echo -n "  F37b 切换用户状态..."
  RESP=$(api_put "/api/users/$USER_ID" '{"status":"disabled"}')
  if echo "$RESP" | grep -q '"success":true'; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-009" "禁用用户" "状态已更新为disabled"
    # 恢复状态
    api_put "/api/users/$USER_ID" '{"status":"active"}' > /dev/null
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-009" "禁用用户" "状态更新失败"
  fi

fi

echo -n "  F39 权限列表..."
RESP=$(api_get "/api/permissions")
if echo "$RESP" | grep -q '\[{'; then
  echo -e " ${GREEN}✓${NC}"; test_pass "REQ-009" "权限列表查询" "返回数据"
else
  echo -e " ${RED}✗${NC}"; test_fail "REQ-009" "权限列表查询" "返回异常"
fi
  echo -n "  F39b 更新角色权限..."
  RESP=$(api_put "/api/permissions" '{"role":"viewer","permissions":["dashboard:view","system:view","classification:view","filing:view","gap:view","rectification:view","assessment:view","document:view","audit:view"]}')
  if echo "$RESP" | grep -q '"success":true'; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-009" "更新角色权限" "权限分配成功"
  else
    echo -e " ${RED}✗${NC}"; test_fail "REQ-009" "更新角色权限" "权限分配失败"
  fi


# ==================== REQ-010: 审计日志 ====================
echo -e "\n${BLUE}═══ REQ-010 审计日志 ═══${NC}"

echo -n "  F40 审计日志列表..."
RESP=$(api_get "/api/audit-logs")
if echo "$RESP" | grep -q '\[{'; then
  echo -e " ${GREEN}✓${NC}"; test_pass "REQ-010" "审计日志查询" "返回数据"
else
  echo -e " ${RED}✗${NC}"; test_fail "REQ-010" "审计日志查询" "返回异常"
fi

echo -n "  F41 按操作类型筛选..."
RESP=$(api_get "/api/audit-logs?action=login")
if echo "$RESP" | grep -q '"action":"login"'; then
  echo -e " ${GREEN}✓${NC}"; test_pass "REQ-010" "审计日志筛选" "筛选正常"
else
  echo -e " ${RED}✗${NC}"; test_fail "REQ-010" "审计日志筛选" "筛选异常"
fi

echo -n "  F42 审计日志导出CSV..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $TOKEN" "$API_BASE/api/audit-logs/export")
if [ "$HTTP_CODE" = "200" ]; then
  echo -e " ${GREEN}✓${NC}"; test_pass "REQ-010" "审计日志导出" "HTTP 200"
else
  echo -e " ${YELLOW}⚠${NC}"; test_fail "REQ-010" "审计日志导出" "HTTP $HTTP_CODE"
fi

# ==================== REQ-011: 系统管理 ====================
echo -e "\n${BLUE}═══ REQ-011 系统管理 ═══${NC}"

echo -n "  F43 系统设置查询..."
RESP=$(api_get "/api/settings")
if echo "$RESP" | grep -q '\[{'; then
  echo -e " ${GREEN}✓${NC}"; test_pass "REQ-011" "系统设置查询" "返回数据"
else
  echo -e " ${RED}✗${NC}"; test_fail "REQ-011" "系统设置查询" "返回异常"
fi

echo -n "  F44 更新系统设置..."
RESP=$(api_put "/api/settings" '[{"key":"upload_path","value":"uploads/"}]')
if echo "$RESP" | grep -q '"success":true'; then
  echo -e " ${GREEN}✓${NC}"; test_pass "REQ-011" "更新系统设置" "更新成功"
else
  echo -e " ${RED}✗${NC}"; test_fail "REQ-011" "更新系统设置" "更新失败"
fi
  echo -n "  F44b LDAP连接测试..."
  RESP=$(api_post "/api/settings/ldap/test" '{"ldap_server":"localhost","ldap_port":"389","ldap_base_dn":"dc=example,dc=com"}')
  if echo "$RESP" | grep -q '"success":true\|"message"'; then
    echo -e " ${GREEN}✓${NC}"; test_pass "REQ-011" "LDAP连接测试" "接口响应正常"
  else
    echo -e " ${YELLOW}⚠${NC}"; test_fail "REQ-011" "LDAP连接测试" "接口异常"
  fi


# ==================== REQ-012: 认证与安全（功能面） ====================
echo -e "\n${BLUE}═══ REQ-012 认证与安全 ═══${NC}"

echo -n "  F45 当前用户信息..."
RESP=$(api_get "/api/me")
if echo "$RESP" | grep -q '"username":"sysadmin"'; then
  echo -e " ${GREEN}✓${NC}"; test_pass "REQ-012" "获取当前用户" "数据正确"
else
  echo -e " ${RED}✗${NC}"; test_fail "REQ-012" "获取当前用户" "数据异常"
fi

echo -n "  F46 登出..."
RESP=$(api_post "/api/logout" '{}')
if echo "$RESP" | grep -q '"success":true'; then
  echo -e " ${GREEN}✓${NC}"; test_pass "REQ-012" "用户登出" "登出成功"
else
  echo -e " ${RED}✗${NC}"; test_fail "REQ-012" "用户登出" "登出失败"
fi

# 重新登录以继续清理
login

# ==================== 清理测试数据 (倒序删除) ====================
echo -e "\n${BLUE}═══ 清理测试数据 ═══${NC}"

for ((i=${#TEST_RESOURCES[@]}-1; i>=0; i--)); do
  RES="${TEST_RESOURCES[$i]}"
  TYPE="${RES%%:*}"
  ID="${RES##*:}"
  echo -n "  清理 $TYPE/$ID..."
  case $TYPE in
    systems) api_delete "/api/systems/$ID" > /dev/null ;;
    # classifications/filings/gap-analyses/rectifications/assessments cascade with system
    documents) api_delete "/api/documents/$ID" > /dev/null ;;
    users) api_delete "/api/users/$ID" > /dev/null ;;
    *) echo -e " ${YELLOW}跳过${NC}" ;;
  esac
  echo -e " ${GREEN}✓${NC}"
done

echo -e "\n${GREEN}✓ 测试数据已清理${NC}"
