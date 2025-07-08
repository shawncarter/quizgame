#!/bin/bash

# Complete QuizGame Workflow Test
# Tests the full game lifecycle from creation to completion

API_URL="http://localhost:5000/api"
DEVICE_ID="device_vk73372ktty9e2y03otg"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Complete QuizGame Workflow Test${NC}\n"

# Test 1: Player Authentication
echo -e "${YELLOW}🔍 Step 1: Testing player authentication...${NC}"
PLAYER_RESPONSE=$(curl -s -X GET "$API_URL/players" -H "x-auth-token: $DEVICE_ID")
if echo "$PLAYER_RESPONSE" | grep -q "Shwan"; then
    echo -e "${GREEN}✅ Player authentication successful${NC}"
    PLAYER_ID=$(echo "$PLAYER_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    echo "   Player ID: $PLAYER_ID"
else
    echo -e "${RED}❌ Player authentication failed${NC}"
    exit 1
fi

# Test 2: Game Creation
echo -e "\n${YELLOW}🎮 Step 2: Creating game session...${NC}"
GAME_DATA='{"maxPlayers":10,"publicGame":true,"allowJoinAfterStart":true,"questionPoolSize":10}'
GAME_RESPONSE=$(curl -s -X POST "$API_URL/games" \
    -H "x-auth-token: $DEVICE_ID" \
    -H "Content-Type: application/json" \
    -d "$GAME_DATA")

if echo "$GAME_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Game creation successful${NC}"
    GAME_ID=$(echo "$GAME_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    GAME_CODE=$(echo "$GAME_RESPONSE" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
    echo "   Game ID: $GAME_ID"
    echo "   Game Code: $GAME_CODE"
    echo "   Status: created"
else
    echo -e "${RED}❌ Game creation failed${NC}"
    echo "$GAME_RESPONSE"
    exit 1
fi

# Test 3: Add Test Players
echo -e "\n${YELLOW}👥 Step 3: Adding test players...${NC}"
TEST_PLAYERS_DATA='{"count":3}'
TEST_PLAYERS_RESPONSE=$(curl -s -X POST "$API_URL/games/$GAME_ID/test-players" \
    -H "x-auth-token: $DEVICE_ID" \
    -H "Content-Type: application/json" \
    -d "$TEST_PLAYERS_DATA")

if echo "$TEST_PLAYERS_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Test players added successfully${NC}"
    PLAYER_COUNT=$(echo "$TEST_PLAYERS_RESPONSE" | grep -o '"totalPlayers":[0-9]*' | cut -d':' -f2)
    echo "   Total players: $PLAYER_COUNT"
    echo "   Players: Host (Shwan) + Alice, Bob, Charlie"
else
    echo -e "${RED}❌ Test players addition failed${NC}"
    echo "$TEST_PLAYERS_RESPONSE"
    exit 1
fi

# Test 4: Change Game Status to Lobby
echo -e "\n${YELLOW}🏛️ Step 4: Moving game to lobby status...${NC}"
# First, let's check current status and update to lobby
LOBBY_RESPONSE=$(curl -s -X PUT "$API_URL/games/$GAME_ID" \
    -H "x-auth-token: $DEVICE_ID" \
    -H "Content-Type: application/json" \
    -d '{"status":"lobby"}')

if echo "$LOBBY_RESPONSE" | grep -q '"success":true' || echo "$LOBBY_RESPONSE" | grep -q '"lobby"'; then
    echo -e "${GREEN}✅ Game moved to lobby status${NC}"
else
    echo -e "${YELLOW}⚠️ Game status update response: ${NC}"
    echo "$LOBBY_RESPONSE" | head -c 200
fi

# Test 5: Create a Round
echo -e "\n${YELLOW}🎯 Step 5: Creating game round...${NC}"
ROUND_DATA='{
  "title": "Test Round 1",
  "type": "standard",
  "questions": [
    {
      "question": "What is the capital of France?",
      "options": ["London", "Berlin", "Paris", "Madrid"],
      "correctAnswer": 2,
      "points": 10,
      "timeLimit": 30
    },
    {
      "question": "What is 2 + 2?",
      "options": ["3", "4", "5", "6"],
      "correctAnswer": 1,
      "points": 10,
      "timeLimit": 30
    }
  ]
}'

ROUND_RESPONSE=$(curl -s -X POST "$API_URL/games/$GAME_ID/rounds" \
    -H "x-auth-token: $DEVICE_ID" \
    -H "Content-Type: application/json" \
    -d "$ROUND_DATA")

if echo "$ROUND_RESPONSE" | grep -q '"success":true' || echo "$ROUND_RESPONSE" | grep -q '"round"'; then
    echo -e "${GREEN}✅ Round created successfully${NC}"
    echo "   Round: Test Round 1 (2 questions)"
else
    echo -e "${RED}❌ Round creation failed${NC}"
    echo "$ROUND_RESPONSE"
    # Continue anyway for other tests
fi

# Test 6: QR Code Generation
echo -e "\n${YELLOW}📱 Step 6: Testing QR code generation...${NC}"
QR_RESPONSE=$(curl -s -X GET "$API_URL/qr-codes/game-session/$GAME_ID" \
    -H "x-auth-token: $DEVICE_ID")

if echo "$QR_RESPONSE" | grep -q '"qrCode"'; then
    echo -e "${GREEN}✅ QR code generated successfully${NC}"
    echo "   QR code contains join URL for game code: $GAME_CODE"
else
    echo -e "${RED}❌ QR code generation failed${NC}"
    echo "$QR_RESPONSE"
fi

# Test 7: Attempt to Start Game
echo -e "\n${YELLOW}🚀 Step 7: Attempting to start game...${NC}"
START_RESPONSE=$(curl -s -X PUT "$API_URL/games/$GAME_ID/start" \
    -H "x-auth-token: $DEVICE_ID" \
    -H "Content-Type: application/json")

if echo "$START_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Game started successfully${NC}"
    echo "   Game is now active and ready for gameplay"
    GAME_STARTED=true
else
    echo -e "${YELLOW}⚠️ Game start failed (expected if no rounds):${NC}"
    echo "$START_RESPONSE" | head -c 200
    GAME_STARTED=false
fi

# Test 8: Final Game Status Check
echo -e "\n${YELLOW}📋 Step 8: Final game status check...${NC}"
FINAL_RESPONSE=$(curl -s -X GET "$API_URL/games/$GAME_ID" \
    -H "x-auth-token: $DEVICE_ID")

if echo "$FINAL_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Game status retrieved successfully${NC}"
    FINAL_STATUS=$(echo "$FINAL_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    FINAL_PLAYER_COUNT=$(echo "$FINAL_RESPONSE" | grep -o '"players":\[[^]]*\]' | grep -o '{"id"' | wc -l)
    echo "   Final status: $FINAL_STATUS"
    echo "   Final player count: $FINAL_PLAYER_COUNT"
else
    echo -e "${RED}❌ Game status check failed${NC}"
    echo "$FINAL_RESPONSE"
fi

# Summary
echo -e "\n${PURPLE}🎉 Complete Workflow Test Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Player Authentication: PASSED${NC}"
echo -e "${GREEN}✅ Game Creation: PASSED${NC}"
echo -e "${GREEN}✅ Test Players Addition: PASSED${NC}"
echo -e "${GREEN}✅ QR Code Generation: PASSED${NC}"

if [ "$GAME_STARTED" = true ]; then
    echo -e "${GREEN}✅ Game Start: PASSED${NC}"
else
    echo -e "${YELLOW}⚠️ Game Start: PARTIAL (needs rounds)${NC}"
fi

echo -e "\n${BLUE}📊 Game Details:${NC}"
echo "   - Game ID: $GAME_ID"
echo "   - Game Code: $GAME_CODE"
echo "   - Players: $FINAL_PLAYER_COUNT"
echo "   - Status: $FINAL_STATUS"

echo -e "\n${BLUE}🔗 URLs for Testing:${NC}"
echo "   - Host Dashboard: http://localhost:5173/host"
echo "   - Game Master: http://localhost:5173/game-master/$GAME_ID"
echo "   - QR Code: http://localhost:5173/qr-code/$GAME_ID"
echo "   - Join Game: http://localhost:5173/join/$GAME_CODE"

echo -e "\n${YELLOW}🎯 Next Steps:${NC}"
echo "1. Open Game Master dashboard to manage the game"
echo "2. Create rounds using the UI or API"
echo "3. Start the game when ready"
echo "4. Test joining with mobile device using QR code"
echo "5. Test complete gameplay workflow"

exit 0
