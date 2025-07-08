#!/bin/bash

# QuizGame Workflow Test Script
# Tests the complete game workflow from creation to gameplay

API_URL="http://localhost:5000/api"
DEVICE_ID="device_vk73372ktty9e2y03otg"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting QuizGame Workflow Test${NC}\n"

# Test 1: Player Authentication
echo -e "${YELLOW}🔍 Testing player authentication...${NC}"
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
echo -e "\n${YELLOW}🎮 Testing game creation...${NC}"
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
else
    echo -e "${RED}❌ Game creation failed${NC}"
    echo "$GAME_RESPONSE"
    exit 1
fi

# Test 3: Add Test Players
echo -e "\n${YELLOW}👥 Testing test players addition...${NC}"
TEST_PLAYERS_DATA='{"count":3}'
TEST_PLAYERS_RESPONSE=$(curl -s -X POST "$API_URL/games/$GAME_ID/test-players" \
    -H "x-auth-token: $DEVICE_ID" \
    -H "Content-Type: application/json" \
    -d "$TEST_PLAYERS_DATA")

if echo "$TEST_PLAYERS_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Test players added successfully${NC}"
    PLAYER_COUNT=$(echo "$TEST_PLAYERS_RESPONSE" | grep -o '"totalPlayers":[0-9]*' | cut -d':' -f2)
    echo "   Total players: $PLAYER_COUNT"
    echo "   Players added: Alice, Bob, Charlie"
else
    echo -e "${RED}❌ Test players addition failed${NC}"
    echo "$TEST_PLAYERS_RESPONSE"
    exit 1
fi

# Test 4: QR Code Generation
echo -e "\n${YELLOW}📱 Testing QR code generation...${NC}"
QR_RESPONSE=$(curl -s -X GET "$API_URL/qr-codes/game-session/$GAME_ID" \
    -H "x-auth-token: $DEVICE_ID")

if echo "$QR_RESPONSE" | grep -q '"qrCode"'; then
    echo -e "${GREEN}✅ QR code generated successfully${NC}"
else
    echo -e "${RED}❌ QR code generation failed${NC}"
    echo "$QR_RESPONSE"
    exit 1
fi

# Test 5: Game Retrieval
echo -e "\n${YELLOW}📋 Testing game retrieval...${NC}"
GAME_GET_RESPONSE=$(curl -s -X GET "$API_URL/games/$GAME_ID" \
    -H "x-auth-token: $DEVICE_ID")

if echo "$GAME_GET_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Game retrieval successful${NC}"
    FINAL_PLAYER_COUNT=$(echo "$GAME_GET_RESPONSE" | grep -o '"players":\[[^]]*\]' | grep -o '{"id"' | wc -l)
    echo "   Final player count: $FINAL_PLAYER_COUNT"
else
    echo -e "${RED}❌ Game retrieval failed${NC}"
    echo "$GAME_GET_RESPONSE"
    exit 1
fi

# Summary
echo -e "\n${GREEN}🎉 All tests passed!${NC}"
echo -e "${BLUE}📊 Test Summary:${NC}"
echo "   - Player ID: $PLAYER_ID"
echo "   - Game ID: $GAME_ID"
echo "   - Game Code: $GAME_CODE"
echo "   - Players: $FINAL_PLAYER_COUNT"
echo "   - QR Code URL: http://localhost:5173/qr-code/$GAME_ID"
echo "   - Join URL: http://localhost:5173/join/$GAME_CODE"

echo -e "\n${YELLOW}🔗 Next Steps:${NC}"
echo "1. Open http://localhost:5173/host to create games via UI"
echo "2. Navigate to http://localhost:5173/game-master/$GAME_ID to manage the game"
echo "3. Click the QR Code button to test QR code display"
echo "4. Use the 'Add Test Players' button to add more test players"
echo "5. Test joining with http://localhost:5173/join/$GAME_CODE"

exit 0
