#!/bin/bash

# End-to-End Test Script for Add Test Players Functionality
# This script tests the complete flow and identifies where issues occur

API_BASE_URL="http://localhost:5000/api"
AUTH_TOKEN="device_vk73372ktty9e2y03otg"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ SUCCESS: $1${NC}"
}

log_failure() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ FAILURE: $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  WARNING: $1${NC}"
}

# Test results tracking
declare -A test_results
test_results[player_auth]=false
test_results[game_creation]=false
test_results[test_players_api]=false
test_results[game_data_retrieval]=false
test_results[server_logs]=false

game_id=""
game_code=""

echo "🚀 Starting End-to-End Test for Add Test Players Functionality"
echo "=============================================================="

# Test 1: Player Authentication
log "=== TESTING PLAYER AUTHENTICATION ==="
response=$(curl -s -w "HTTPSTATUS:%{http_code}" -H "x-auth-token: $AUTH_TOKEN" "$API_BASE_URL/players")
http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
body=$(echo $response | sed -e 's/HTTPSTATUS\:.*//g')

if [ "$http_code" -eq 200 ]; then
    log_success "Player authentication successful"
    echo "Response: $body"
    test_results[player_auth]=true
    player_id=$(echo $body | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    log "Player ID: $player_id"
else
    log_failure "Player authentication failed (HTTP $http_code)"
    echo "Response: $body"
    exit 1
fi

# Test 2: Game Creation
log "=== TESTING GAME CREATION ==="
response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "x-auth-token: $AUTH_TOKEN" \
    -d '{"maxPlayers":10,"publicGame":true}' \
    "$API_BASE_URL/games")

http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
body=$(echo $response | sed -e 's/HTTPSTATUS\:.*//g')

if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
    log_success "Game creation successful"
    echo "Response: $body"
    test_results[game_creation]=true
    
    # Extract game ID and code
    game_id=$(echo $body | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    game_code=$(echo $body | grep -o '"code":"[^"]*"' | head -1 | cut -d'"' -f4)
    log "Game ID: $game_id"
    log "Game Code: $game_code"
else
    log_failure "Game creation failed (HTTP $http_code)"
    echo "Response: $body"
    exit 1
fi

# Test 3: Add Test Players
log "=== TESTING ADD TEST PLAYERS API ==="
log "Adding test players to game $game_id..."

response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "x-auth-token: $AUTH_TOKEN" \
    -d '{"count":2}' \
    "$API_BASE_URL/games/$game_id/test-players")

http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
body=$(echo $response | sed -e 's/HTTPSTATUS\:.*//g')

if [ "$http_code" -eq 200 ]; then
    log_success "Test players added successfully"
    echo "Response: $body"
    test_results[test_players_api]=true
    
    # Extract player count
    total_players=$(echo $body | grep -o '"totalPlayers":[0-9]*' | cut -d':' -f2)
    log "Total players now: $total_players"
else
    log_failure "Add test players failed (HTTP $http_code)"
    echo "Response: $body"
fi

# Test 4: Verify Game Data After Adding Players
log "=== TESTING GAME DATA RETRIEVAL AFTER ADDING PLAYERS ==="
sleep 1  # Give a moment for any async operations

response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -H "x-auth-token: $AUTH_TOKEN" \
    "$API_BASE_URL/games/$game_id")

http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
body=$(echo $response | sed -e 's/HTTPSTATUS\:.*//g')

if [ "$http_code" -eq 200 ]; then
    log_success "Game data retrieved successfully"
    echo "Response: $body"
    
    # Check if players are present
    player_count=$(echo $body | grep -o '"players":\[[^]]*\]' | grep -o '"id":"[^"]*"' | wc -l)
    log "Players found in game data: $player_count"
    
    if [ "$player_count" -ge 2 ]; then
        log_success "Test players are present in game data"
        test_results[game_data_retrieval]=true
    else
        log_failure "Test players are missing from game data"
        echo "Expected at least 2 players, found: $player_count"
    fi
else
    log_failure "Game data retrieval failed (HTTP $http_code)"
    echo "Response: $body"
fi

# Test 5: Check Server Logs for Socket Events
log "=== CHECKING SERVER LOGS FOR SOCKET EVENTS ==="
log "Looking for socket event emissions in recent server logs..."

# Check if we can find socket event logs
if [ -f "server/logs/server-out.log" ]; then
    recent_logs=$(tail -20 "server/logs/server-out.log" | grep -i "socket\|emit\|players")
    if [ ! -z "$recent_logs" ]; then
        log_success "Found socket-related logs"
        echo "$recent_logs"
        test_results[server_logs]=true
    else
        log_warning "No socket-related logs found in recent output"
    fi
else
    log_warning "Server log file not found"
fi

# Test Results Summary
echo ""
log "=== TEST RESULTS SUMMARY ==="
echo "=============================================================="

total_tests=0
passed_tests=0

for test in "${!test_results[@]}"; do
    total_tests=$((total_tests + 1))
    if [ "${test_results[$test]}" = true ]; then
        log_success "$test"
        passed_tests=$((passed_tests + 1))
    else
        log_failure "$test"
    fi
done

echo ""
log "Overall: $passed_tests/$total_tests tests passed"

if [ "$passed_tests" -eq "$total_tests" ]; then
    log_success "All tests passed! The functionality should be working."
    exit 0
else
    log_failure "Some tests failed. Check the logs above for details."
    
    # Provide specific guidance based on failures
    echo ""
    log "=== DEBUGGING GUIDANCE ==="
    
    if [ "${test_results[player_auth]}" = false ]; then
        echo "❌ Player authentication failed - check if server is running and auth token is correct"
    fi
    
    if [ "${test_results[game_creation]}" = false ]; then
        echo "❌ Game creation failed - check server logs and database connection"
    fi
    
    if [ "${test_results[test_players_api]}" = false ]; then
        echo "❌ Test players API failed - check server logs for errors in the add test players endpoint"
    fi
    
    if [ "${test_results[game_data_retrieval]}" = false ]; then
        echo "❌ Game data retrieval failed - players were added but not persisted or not returned correctly"
    fi
    
    if [ "${test_results[server_logs]}" = false ]; then
        echo "❌ No socket logs found - socket events may not be emitting"
    fi
    
    exit 1
fi
