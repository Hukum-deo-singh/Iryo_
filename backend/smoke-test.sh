#!/usr/bin/env bash
# Checks the whole flow against a running backend.
#   bash backend/smoke-test.sh [backend-url]      (default http://localhost:8080)
# Needs ADMIN_API_KEY in the environment (source backend/.env first), and curl and jq.
# It creates a throwaway account and device. The fake reading belongs to that account only.
set -u
H="${1:-http://localhost:8080}"
: "${ADMIN_API_KEY:?Run: set -a; source backend/.env; set +a}"
command -v jq >/dev/null || { echo "jq is required"; exit 1; }

PASS=0; FAIL=0
ok()   { echo "  PASS  $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $1  ($2)"; FAIL=$((FAIL+1)); }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
expect() { [ "$2" = "$3" ] && ok "$1" || bad "$1" "expected $2, got $3"; }
J='Content-Type: application/json'

N=$RANDOM$RANDOM
DEV="SMOKE-$N"; EMAIL="smoke$N@example.com"; PASSWORD="Smoke1234pass"

expect "health" 200 "$(code "$H/api/health")"
KEY=$(curl -s -X POST "$H/api/admin/devices" -H "X-Admin-Key: $ADMIN_API_KEY" -H "$J" -d "{\"deviceId\":\"$DEV\"}" | jq -r .ingestKey)
[ -n "$KEY" ] && [ "$KEY" != null ] && ok "register device" || bad "register device" "no key returned"
TOKEN=$(curl -s -X POST "$H/api/auth/signup" -H "$J" -d "{\"displayName\":\"Smoke Test\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r .accessToken)
[ -n "$TOKEN" ] && [ "$TOKEN" != null ] && ok "sign up" || bad "sign up" "no token returned"
A="Authorization: Bearer $TOKEN"
expect "profile" 200 "$(code "$H/api/users/me" -H "$A")"
expect "no token is refused" 401 "$(code "$H/api/users/me")"
expect "no device yet" 404 "$(code "$H/api/devices/me" -H "$A")"
expect "unknown device" 404 "$(code -X POST "$H/api/devices/assign" -H "$A" -H "$J" -d '{"deviceId":"NOPE-0000"}')"
expect "connect device" 200 "$(code -X POST "$H/api/devices/assign" -H "$A" -H "$J" -d "{\"deviceId\":\"$(echo $DEV | tr A-Z a-z)\"}")"
SECS=$(curl -s "$H/api/devices/me" -H "$A" | jq -r .remainingSeconds)
[ "${SECS:-0}" -gt 0 ] 2>/dev/null && ok "session running ($SECS s left)" || bad "session running" "remainingSeconds=$SECS"
expect "wrong device key is refused" 401 "$(code -X POST "$H/api/ingest/measurements" -H "X-Device-Key: wrong" -H "$J" -d "{\"deviceId\":\"$DEV\",\"spo2Percent\":97,\"temperatureC\":36.7}")"
expect "impossible value is refused" 400 "$(code -X POST "$H/api/ingest/measurements" -H "X-Device-Key: $KEY" -H "$J" -d "{\"deviceId\":\"$DEV\",\"spo2Percent\":12,\"temperatureC\":36.7}")"
BODY="{\"deviceId\":\"$DEV\",\"spo2Percent\":97,\"temperatureC\":36.7,\"heartRateBpm\":72,\"heightCm\":171.5,\"messageId\":\"smoke-$N\"}"
expect "send a reading" 201 "$(code -X POST "$H/api/ingest/measurements" -H "X-Device-Key: $KEY" -H "$J" -d "$BODY")"
expect "same reading again is a duplicate" 200 "$(code -X POST "$H/api/ingest/measurements" -H "X-Device-Key: $KEY" -H "$J" -d "$BODY")"
LATEST=$(curl -s "$H/api/measurements/latest" -H "$A")
[ "$(echo "$LATEST" | jq -r .heartRateBpm)" = "72" ] && [ "$(echo "$LATEST" | jq -r .heightCm)" = "171.5" ] && ok "latest has heart rate and height" || bad "latest" "$LATEST"
[ "$(echo "$LATEST" | jq '.derived | length')" = "2" ] && ok "insights returned" || bad "insights" "missing"
expect "history" 200 "$(code "$H/api/measurements/history?range=7d" -H "$A")"
expect "bad range" 400 "$(code "$H/api/measurements/history?range=1y" -H "$A")"
expect "sign out" 204 "$(code -X POST "$H/api/auth/logout" -H "$A")"
expect "old token is dead" 401 "$(code "$H/api/users/me" -H "$A")"

echo; echo "Passed: $PASS   Failed: $FAIL"
[ "$FAIL" -eq 0 ]
