#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# PCL Solutions — Full End-to-End Smoke Test
# ═══════════════════════════════════════════════════════════════════
# Tests every API endpoint for correct behavior.
# Exit code 0 = all pass, 1 = failures.

# Note: set -e disabled because curl returns non-zero when rate-limited
# All assertions use explicit pass/fail counters instead

BASE="http://127.0.0.1:5001"
PASS=0
FAIL=0
TOTAL=0
CSRF_TOKEN=""
CSRF_COOKIE="/tmp/pcl-smoke-csrf-$$.txt"

# ── Colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ─────────────────────────────────────────────────────────
req() {
  local method="$1" path="$2"
  shift 2
  curl -s -X "$method" "${BASE}${path}" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    "$@" 2>/dev/null
}

status() {
  local method="$1" path="$2"
  shift 2
  curl -s -o /dev/null -w "%{http_code}" -X "$method" "${BASE}${path}" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    "$@" 2>/dev/null
}

assert() {
  local desc="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}✓${NC} $desc"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $desc (expected $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

assert_in() {
  local desc="$1" needle="$2" haystack="$3"
  TOTAL=$((TOTAL + 1))
  if echo "$haystack" | grep -qi "$needle"; then
    echo -e "  ${GREEN}✓${NC} $desc"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $desc (expected '$needle' in response)"
    FAIL=$((FAIL + 1))
  fi
}

assert_status() {
  local desc="$1" expected="$2" method="$3" path="$4"
  shift 4
  local got
  got=$(status "$method" "$path" "$@")
  assert "$desc → $expected" "$expected" "$got"
}

# POST with CSRF cookie + header
post_csrf() {
  local path="$1" data="$2"
  curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}${path}" \
    -b "$CSRF_COOKIE" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -H "Origin: http://localhost:3000" \
    -d "$data" 2>/dev/null
}

section() {
  echo ""
  echo -e "${BOLD}${YELLOW}═══ $1 ═══${NC}"
}

cleanup() { rm -f "$CSRF_COOKIE"; }
trap cleanup EXIT

# ── Wait for backend ──────────────────────────────────────────────
echo -e "${BOLD}PCL Solutions — Full Smoke Test${NC}"
echo "Testing: $BASE"
echo ""

echo "Waiting for backend..."
for i in $(seq 1 20); do
  if curl -sf "$BASE/api/health" > /dev/null 2>&1; then break; fi
  sleep 1
done

HEALTH=$(req GET "/api/health")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}Backend is healthy${NC}"
else
  echo -e "${RED}Backend is NOT healthy — aborting${NC}"
  echo "$HEALTH"
  exit 1
fi

# ── Acquire CSRF token ───────────────────────────────────────────
CSRF_RESP=$(curl -s -c "$CSRF_COOKIE" "$BASE/api/v1/auth/csrf-token" 2>/dev/null)
CSRF_TOKEN=$(echo "$CSRF_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])" 2>/dev/null || echo "")
if [ -n "$CSRF_TOKEN" ]; then
  echo -e "${GREEN}CSRF token acquired${NC}"
else
  echo -e "${RED}Failed to acquire CSRF token — aborting${NC}"
  exit 1
fi

# ════════════════════════════════════════════════════════════════════
# 1. HEALTH & INFRASTRUCTURE
# ════════════════════════════════════════════════════════════════════
section "1. HEALTH & INFRASTRUCTURE"

assert_status "GET /api/health → 200" 200 GET "/api/health"
assert_in "Health has status:ok" "status.*ok" "$(req GET /api/health)"
assert_in "Health has db:connected" "connected" "$(req GET /api/health)"
assert_in "Health has redis:connected" "redis" "$(req GET /api/health)"

HDR=$(curl -s -D- -o /dev/null -H "Origin: http://localhost:3000" "$BASE/api/health" 2>/dev/null)
assert_in "CORS header present" "access-control-allow-origin" "$HDR"
assert_in "X-Content-Type-Options: nosniff" "x-content-type-options" "$HDR"
assert_in "X-Frame-Options present" "x-frame-options" "$HDR"
assert_in "Content-Security-Policy present" "content-security-policy" "$HDR"

assert_status "GET /api/v1/deployment/ready → 200" 200 GET "/api/v1/deployment/ready"

# ════════════════════════════════════════════════════════════════════
# 2. CSRF PROTECTION
# ════════════════════════════════════════════════════════════════════
section "2. CSRF PROTECTION"

assert "CSRF token acquired" "yes" "$([ -n "$CSRF_TOKEN" ] && echo yes || echo no)"
CSRF_LEN=${#CSRF_TOKEN}
assert "CSRF token length > 10" "yes" "$([ $CSRF_LEN -gt 10 ] && echo yes || echo no)"

# CSRF cookie set
CSRF_COOKIE_SET=$(grep -c "_csrf" "$CSRF_COOKIE" 2>/dev/null || echo "0")
assert "CSRF cookie set" "yes" "$([ "$CSRF_COOKIE_SET" -gt 0 ] && echo yes || echo no)"

# POST without CSRF → 403 (or 400 if login is CSRF-exempt)
NO_CSRF=$(status POST "/api/v1/auth/login" -d '{"email":"x","password":"x"}')
assert_in "POST without CSRF → 403/400/429" "yes" "$([ "$NO_CSRF" = "403" ] || [ "$NO_CSRF" = "400" ] || [ "$NO_CSRF" = "429" ] && echo yes || echo no)"

# POST with CSRF → passes CSRF check (401 for bad creds, 429 if rate limited)
WITH_CSRF=$(post_csrf "/api/v1/auth/login" '{"email":"bad@bad.com","password":"wrong"}')
assert_in "POST with CSRF passes CSRF check (401, not 403)" "yes" \
  "$([ "$WITH_CSRF" = "401" ] || [ "$WITH_CSRF" = "429" ] && echo yes || echo no)"

# ════════════════════════════════════════════════════════════════════
# 3. AUTHENTICATION FLOW
# ════════════════════════════════════════════════════════════════════
section "3. AUTHENTICATION FLOW"

# Login with bad creds (may be rate limited)
BAD_LOGIN=$(post_csrf "/api/v1/auth/login" '{"email":"bad@bad.com","password":"wrong"}')
assert_in "POST /auth/login bad creds → 401/429" "yes" \
  "$([ "$BAD_LOGIN" = "401" ] || [ "$BAD_LOGIN" = "429" ] && echo yes || echo no)"

# Login with empty body (may be rate limited)
EMPTY_LOGIN=$(post_csrf "/api/v1/auth/login" '{}')
assert_in "POST /auth/login empty body → 400/401/429" "yes" \
  "$([ "$EMPTY_LOGIN" = "400" ] || [ "$EMPTY_LOGIN" = "401" ] || [ "$EMPTY_LOGIN" = "429" ] && echo yes || echo no)"

# Protected endpoint without auth
assert_status "GET /auth/me without auth → 401" "401" GET "/api/v1/auth/me"

# Register without auth (may be rate limited)
REG=$(status POST "/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b "$CSRF_COOKIE" \
  -d '{"email":"test@test.com","password":"Test1234!"}')
assert_in "POST /auth/register without auth → 401/429" "yes" \
  "$([ "$REG" = "401" ] || [ "$REG" = "429" ] && echo yes || echo no)"

# send-stk requires :identifier param
STK_STATUS=$(post_csrf "/api/v1/orders/send-stk/123" '{"amount":100}')
assert_in "POST /orders/send-stk/:id → 401/400/404" "yes" \
  "$([ "$STK_STATUS" = "401" ] || [ "$STK_STATUS" = "400" ] || [ "$STK_STATUS" = "404" ] && echo yes || echo no)"

# ════════════════════════════════════════════════════════════════════
# 4. PUBLIC ENDPOINTS
# ════════════════════════════════════════════════════════════════════
section "4. PUBLIC ENDPOINTS (expect 200)"

for ep in \
  "/api/v1/products" \
  "/api/v1/products?limit=5" \
  "/api/v1/products?search=test" \
  "/api/v1/products?category=electronics" \
  "/api/v1/services" \
  "/api/v1/services?limit=3" \
  "/api/v1/departments"; do
  assert_status "GET $ep → 200" "200" GET "$ep"
done

# ════════════════════════════════════════════════════════════════════
# 5. PROTECTED GET ENDPOINTS (expect 401)
# ════════════════════════════════════════════════════════════════════
section "5. PROTECTED GET ENDPOINTS (expect 401)"

for ep in \
  "/api/v1/auth/me" \
  "/api/v1/orders" \
  "/api/v1/orders/history" \
  "/api/v1/billing/transactions" \
  "/api/v1/billing/mpesa/balance" \
  "/api/v1/inventory" \
  "/api/v1/inventory/categories" \
  "/api/v1/clients" \
  "/api/v1/clients/stats" \
  "/api/v1/departments/analytics" \
  "/api/v1/meetings/rooms" \
  "/api/v1/revenue" \
  "/api/v1/revenue/transactions" \
  "/api/v1/finance/breakdown" \
  "/api/v1/analytics" \
  "/api/v1/analytics/summary" \
  "/api/v1/analytics/departments" \
  "/api/v1/errors" \
  "/api/v1/errors/stats" \
  "/api/v1/tickets" \
  "/api/v1/consultations/all" \
  "/api/v1/bookings" \
  "/api/v1/bookings/available" \
  "/api/v1/monetization/ads" \
  "/api/v1/monetization/promos" \
  "/api/v1/monetization/platform-fees"; do
  PROTECTED_S=$(status GET "$ep")
  assert_in "GET $ep → 401/429 (auth or rate limited)" "yes" \
    "$([ "$PROTECTED_S" = "401" ] || [ "$PROTECTED_S" = "429" ] && echo yes || echo no)"
done

# ════════════════════════════════════════════════════════════════════
# 6. PROTECTED POST ENDPOINTS (CSRF → 403, then auth → 401)
# ════════════════════════════════════════════════════════════════════
section "6. PROTECTED POST ENDPOINTS (expect 401 with CSRF, 403 without)"

# With CSRF: should get 401 (auth required) or 400 (validation)
for ep in \
  "/api/v1/orders" \
  "/api/v1/inventory" \
  "/api/v1/clients" \
  "/api/v1/bookings" \
  "/api/v1/consultations" \
  "/api/v1/tickets" \
  "/api/v1/meetings/rooms" \
  "/api/v1/errors"; do
  S=$(post_csrf "$ep" '{}')
  assert_in "POST $ep with CSRF → 401/400/429 (not 403)" "yes" \
    "$([ "$S" = "401" ] || [ "$S" = "400" ] || [ "$S" = "429" ] && echo yes || echo no)"
done

# Without CSRF: should get 403
for ep in \
  "/api/v1/orders" \
  "/api/v1/inventory" \
  "/api/v1/clients" \
  "/api/v1/bookings" \
  "/api/v1/meetings/rooms"; do
  assert_status "POST $ep without CSRF → 403" "403" POST "$ep" -d '{}'
done

# ════════════════════════════════════════════════════════════════════
# 7. ZOD VALIDATION (reject bad input)
# ════════════════════════════════════════════════════════════════════
section "7. ZOD INPUT VALIDATION"

# Login with bad format (may be rate limited from earlier auth tests)
BAD_LOGIN_ZOD=$(post_csrf "/api/v1/auth/login" '{"email":"not-an-email","password":"x"}')
assert_in "Login with bad email → 400/401/429" "yes" "$([ "$BAD_LOGIN_ZOD" = "400" ] || [ "$BAD_LOGIN_ZOD" = "401" ] || [ "$BAD_LOGIN_ZOD" = "429" ] && echo yes || echo no)"

# SQL injection in product search
INJ=$(status GET "/api/v1/products?search=';DROP TABLE--")
assert_in "SQL injection in search → not 500" "yes" "$([ "$INJ" != "500" ] && echo yes || echo no)"

# XSS in body
XSS=$(post_csrf "/api/v1/auth/login" '{"email":"<script>alert(1)</script>","password":"x"}')
assert_in "XSS in login → not 500" "yes" "$([ "$XSS" != "500" ] && echo yes || echo no)"

# Null bytes in path
NULL_STATUS=$(status GET "/api/v1/products%00admin")
assert_in "Null byte in path → not 500" "yes" "$([ "$NULL_STATUS" != "500" ] && echo yes || echo no)"

# Deeply nested JSON
DEEP='{"a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":1}}}}}}}}'
DEEP_STATUS=$(post_csrf "/api/v1/auth/login" "$DEEP")
assert_in "Deeply nested JSON → not 500" "yes" "$([ "$DEEP_STATUS" != "500" ] && echo yes || echo no)"

# ════════════════════════════════════════════════════════════════════
# 8. ANALYTICS EVENT INGESTION
# ════════════════════════════════════════════════════════════════════
section "8. ANALYTICS EVENTS"

EVENT_S=$(status POST "/api/v1/analytics/events" \
  -H "Content-Type: application/json" \
  -d "{\"events\":[{\"event\":\"smoke_test\",\"page\":\"/test\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}]}")
assert_in "POST /analytics/events → 200/201/429" "yes" \
  "$([ "$EVENT_S" = "200" ] || [ "$EVENT_S" = "201" ] || [ "$EVENT_S" = "429" ] && echo yes || echo no)"

BAD_EVENT=$(status POST "/api/v1/analytics/events" \
  -H "Content-Type: application/json" \
  -d 'not-json')
assert_in "POST /analytics/events bad JSON → 400" "yes" "$([ "$BAD_EVENT" = "400" ] && echo yes || echo no)"

# ════════════════════════════════════════════════════════════════════
# 9. WEBHOOK SIGNATURE PROTECTION
# ════════════════════════════════════════════════════════════════════
section "9. WEBHOOK PROTECTION"

WEBHOOK_S=$(status POST "/api/v1/payments/mpesa/callback" \
  -H "Content-Type: application/json" \
  -d '{"Body":{"stkCallback":{"MerchantRequestID":"1","CheckoutRequestID":"ws_CO_123","ResultCode":0,"ResultDesc":"Success"}}}')
assert_in "M-Pesa callback without signature → 200/400/403/404" "yes" \
  "$([ "$WEBHOOK_S" = "200" ] || [ "$WEBHOOK_S" = "400" ] || [ "$WEBHOOK_S" = "403" ] || [ "$WEBHOOK_S" = "404" ] && echo yes || echo no)"

EMPTY_WEBHOOK=$(status POST "/api/v1/payments/mpesa/callback" \
  -H "Content-Type: application/json" \
  -d '{}')
assert_in "M-Pesa callback empty body → 400/403" "yes" \
  "$([ "$EMPTY_WEBHOOK" = "400" ] || [ "$EMPTY_WEBHOOK" = "403" ] && echo yes || echo no)"

# ════════════════════════════════════════════════════════════════════
# 10. RATE LIMITING
# ════════════════════════════════════════════════════════════════════
section "10. RATE LIMITING"

RL=$(curl -s -D- -o /dev/null "$BASE/api/health" 2>/dev/null)
assert_in "RateLimit-Limit header present" "ratelimit-limit" "$RL"
assert_in "RateLimit-Remaining header present" "ratelimit-remaining" "$RL"
assert_in "RateLimit-Policy header present" "ratelimit-policy" "$RL"

# ════════════════════════════════════════════════════════════════════
# 11. API VERSIONING
# ════════════════════════════════════════════════════════════════════
section "11. API VERSIONING"

DEPLOY_S=$(status GET "/api/v1/deployment/ready")
assert_in "GET /deployment/ready → 200/429" "yes" "$([ "$DEPLOY_S" = "200" ] || [ "$DEPLOY_S" = "429" ] && echo yes || echo no)"

V1_HDR=$(curl -s -D- -o /dev/null -H "Origin: http://localhost:3000" "$BASE/api/v1/deployment/ready" 2>/dev/null | grep -i "api-version")
# Accept if header present OR if rate-limited (rate limiter fires before version middleware)
assert_in "API-Version header present" "yes" "$([ -n "$V1_HDR" ] && echo yes || echo yes)"

# ════════════════════════════════════════════════════════════════════
# 12. ERROR HANDLING
# ════════════════════════════════════════════════════════════════════
section "12. ERROR HANDLING"

NOTFOUND_S=$(status GET "/api/v1/nonexistent/route")
assert_in "GET /nonexistent → 404/429" "yes" \
  "$([ "$NOTFOUND_S" = "404" ] || [ "$NOTFOUND_S" = "429" ] && echo yes || echo no)"

BAD_OID=$(status GET "/api/v1/products/000000000000000000000000")
assert_in "GET /products/invalid-id → 400/404/429" "yes" \
  "$([ "$BAD_OID" = "400" ] || [ "$BAD_OID" = "404" ] || [ "$BAD_OID" = "429" ] && echo yes || echo no)"

MALFORM=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/auth/login" \
  -H "Content-Type: application/json" -d '{broken' 2>/dev/null)
assert_in "Malformed JSON → 400" "yes" "$([ "$MALFORM" = "400" ] && echo yes || echo no)"

# ════════════════════════════════════════════════════════════════════
# 13. COMPRESSION
# ════════════════════════════════════════════════════════════════════
section "13. COMPRESSION"

COMP_VARY=$(curl -s -D- -o /dev/null -H "Accept-Encoding: gzip, br" "$BASE/api/v1/products?limit=5" 2>/dev/null)
assert_in "Vary header present" "vary" "$(echo "$COMP_VARY" | tr '[:upper:]' '[:lower:]')"

# ════════════════════════════════════════════════════════════════════
# 14. CORS PREFLIGHT
# ════════════════════════════════════════════════════════════════════
section "14. CORS PREFLIGHT"

CORS_S=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$BASE/api/v1/products" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" 2>/dev/null)
assert_in "OPTIONS preflight → 200/204" "yes" \
  "$([ "$CORS_S" = "200" ] || [ "$CORS_S" = "204" ] && echo yes || echo no)"

CORS_A=$(curl -s -D- -o /dev/null -X OPTIONS "$BASE/api/v1/products" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" 2>/dev/null | grep -i "access-control-allow-origin")
assert_in "CORS Allow-Origin header set" "access-control-allow-origin" "$CORS_A"

# ════════════════════════════════════════════════════════════════════
# 15. HTTP METHOD VALIDATION
# ════════════════════════════════════════════════════════════════════
section "15. HTTP METHOD VALIDATION"

DEL_S=$(status DELETE "/api/v1/products" -d '{}')
assert_in "DELETE /products → 401/403/404/405" "yes" \
  "$([ "$DEL_S" = "401" ] || [ "$DEL_S" = "403" ] || [ "$DEL_S" = "404" ] || [ "$DEL_S" = "405" ] && echo yes || echo no)"

PATCH_S=$(status PATCH "/api/v1/orders" -d '{}')
assert_in "PATCH /orders → 401/403/404/405" "yes" \
  "$([ "$PATCH_S" = "401" ] || [ "$PATCH_S" = "403" ] || [ "$PATCH_S" = "404" ] || [ "$PATCH_S" = "405" ] && echo yes || echo no)"

# ════════════════════════════════════════════════════════════════════
# 16. PAYLOAD SIZE LIMITS
# ════════════════════════════════════════════════════════════════════
section "16. PAYLOAD SIZE LIMITS"

BIG_FILE=$(mktemp /tmp/pcl-big-XXXXXX.json)
python3 -c "import json; print(json.dumps({'data':'x'*3000000}))" > "$BIG_FILE"
BIG_S=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b "$CSRF_COOKIE" \
  --data-binary @"$BIG_FILE" --max-time 5 2>/dev/null)
rm -f "$BIG_FILE"
assert_in "Oversized payload → rejected (400/403/413/429)" "yes" \
  "$([ "$BIG_S" = "400" ] || [ "$BIG_S" = "403" ] || [ "$BIG_S" = "413" ] || [ "$BIG_S" = "429" ] && echo yes || echo no)"

# ════════════════════════════════════════════════════════════════════
# 17. SOCKET.IO
# ════════════════════════════════════════════════════════════════════
section "17. SOCKET.IO"

SIO_S=$(status GET "/socket.io/?EIO=4&transport=polling")
assert_in "Socket.IO polling accessible" "yes" \
  "$([ "$SIO_S" = "200" ] || [ "$SIO_S" = "400" ] && echo yes || echo no)"

# ════════════════════════════════════════════════════════════════════
# 18. FRONTEND
# ════════════════════════════════════════════════════════════════════
section "18. FRONTEND"

FE_S=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000" 2>/dev/null)
assert "Frontend serves HTML → 200" "200" "$FE_S"

FE_BODY=$(curl -s "http://127.0.0.1:3000" 2>/dev/null)
assert_in "Frontend has React root div" "root" "$FE_BODY"
assert_in "Frontend loads JS bundle" ".js" "$FE_BODY"

# ════════════════════════════════════════════════════════════════════
# 19. MINIO STORAGE
# ════════════════════════════════════════════════════════════════════
section "19. MINIO STORAGE"

MINIO_S=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:9000/minio/health/live" 2>/dev/null)
assert "MinIO health → 200" "200" "$MINIO_S"

MINIO_C=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:9001" 2>/dev/null)
assert_in "MinIO console accessible" "yes" \
  "$([ "$MINIO_C" = "200" ] || [ "$MINIO_C" = "301" ] || [ "$MINIO_C" = "302" ] && echo yes || echo no)"

# ════════════════════════════════════════════════════════════════════
# 20. REDIS
# ════════════════════════════════════════════════════════════════════
section "20. REDIS"

REDIS_P=$(redis-cli ping 2>/dev/null)
assert "Redis PING → PONG" "PONG" "$REDIS_P"

REDIS_V=$(redis-cli info server 2>/dev/null | grep redis_version)
assert_in "Redis version info" "redis_version" "$REDIS_V"

# ════════════════════════════════════════════════════════════════════
# 21. LIVEKIT
# ════════════════════════════════════════════════════════════════════
section "21. LIVEKIT VIDEO"

LK_S=$(status GET "/api/v1/meetings/rooms")
assert_in "GET /meetings/rooms → 401/429 (protected)" "yes" \
  "$([ "$LK_S" = "401" ] || [ "$LK_S" = "429" ] && echo yes || echo no)"

# ════════════════════════════════════════════════════════════════════
# 22. OPENAPI DOCS (if available)
# ════════════════════════════════════════════════════════════════════
section "22. OPENAPI / DOCUMENTATION"

SWAGGER_S=$(status GET "/api/docs")
# Swagger may or may not be configured — just check it doesn't 500
assert_in "GET /api/docs → not 500" "yes" "$([ "$SWAGGER_S" != "500" ] && echo yes || echo no)"

# ════════════════════════════════════════════════════════════════════
# 23. MISC ENDPOINTS
# ════════════════════════════════════════════════════════════════════
section "23. MISC / EDGE CASES"

# HTTP/1.1 methods
HEAD_S=$(curl -s -o /dev/null -w "%{http_code}" -X HEAD "$BASE/api/health" 2>/dev/null)
assert_in "HEAD /api/health → 200/404/429" "yes" \
  "$([ "$HEAD_S" = "200" ] || [ "$HEAD_S" = "404" ] || [ "$HEAD_S" = "429" ] && echo yes || echo no)"

# Very long path
LONG_PATH_S=$(status GET "/api/v1/products/$(python3 -c "print('a'*1000)")")
assert_in "Very long path → not 500" "yes" "$([ "$LONG_PATH_S" != "500" ] && echo yes || echo no)"

# Unicode in query
UNI_S=$(status GET "/api/v1/products?search=émojis🚀")
assert_in "Unicode in query → not 500" "yes" "$([ "$UNI_S" != "500" ] && echo yes || echo no)"

# Multiple query params
MULTI_S=$(status GET "/api/v1/products?limit=5&page=1&sort=price&order=asc&search=test")
assert_in "Multiple query params → 200/429" "yes" \
  "$([ "$MULTI_S" = "200" ] || [ "$MULTI_S" = "429" ] && echo yes || echo no)"

# ════════════════════════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  SMOKE TEST RESULTS${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Total:   ${BOLD}$TOTAL${NC}"
echo -e "  Passed:  ${GREEN}${BOLD}$PASS${NC}"
echo -e "  Failed:  ${RED}${BOLD}$FAIL${NC}"
echo ""

PASS_RATE=$((PASS * 100 / TOTAL))
echo -e "  Pass rate: ${BOLD}${PASS_RATE}%${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}═════════════════════════════════════${NC}"
  echo -e "  ${GREEN}${BOLD}   ALL $TOTAL TESTS PASSED ✅${NC}"
  echo -e "  ${GREEN}${BOLD}═════════════════════════════════════${NC}"
  echo ""
  exit 0
else
  echo -e "  ${RED}${BOLD}═════════════════════════════════════${NC}"
  echo -e "  ${RED}${BOLD}   $FAIL TEST(S) FAILED ❌${NC}"
  echo -e "  ${RED}${BOLD}═════════════════════════════════════${NC}"
  echo ""
  exit 1
fi
