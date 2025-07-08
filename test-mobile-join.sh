#!/bin/bash

echo "🔍 TESTING MOBILE JOIN PROCESS"
echo "==============================="

API_URL="http://192.168.0.87:5000/api"
MOBILE_DEVICE_ID="device_mobile_test_$(date +%s)"

echo "Using mobile device ID: $MOBILE_DEVICE_ID"
echo "API URL: $API_URL"
echo ""

# Step 1: Test if API is accessible
echo "1. Testing API accessibility..."
API_TEST=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/players" -H "x-auth-token: $MOBILE_DEVICE_ID")
if [ "$API_TEST" = "200" ] || [ "$API_TEST" = "401" ]; then
    echo "✅ API accessible (HTTP $API_TEST)"
else
    echo "❌ API not accessible (HTTP $API_TEST)"
    exit 1
fi

# Step 2: Test player registration
echo ""
echo "2. Testing player registration..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/players" \
    -H "Content-Type: application/json" \
    -H "x-auth-token: $MOBILE_DEVICE_ID" \
    -d '{
        "name": "Mobile Test Player",
        "age": 25,
        "specialistSubject": "General Knowledge",
        "avatar": "default-avatar",
        "buzzerSound": "default-buzzer",
        "deviceId": "'$MOBILE_DEVICE_ID'"
    }' 2>&1)

echo "Registration response:"
echo "$REGISTER_RESPONSE"

if echo "$REGISTER_RESPONSE" | grep -q '"id"'; then
    echo "✅ Player registration successful"
    PLAYER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    echo "Player ID: $PLAYER_ID"
else
    echo "❌ Player registration failed"
    echo "Response: $REGISTER_RESPONSE"
    exit 1
fi

# Step 3: Test game code validation
echo ""
echo "3. Testing game code validation..."
echo "First, let's see what games exist:"
GAMES_RESPONSE=$(curl -s "$API_URL/games" -H "x-auth-token: $MOBILE_DEVICE_ID")
echo "Games response: $GAMES_RESPONSE"

# Try to extract a game code
GAME_CODE=$(echo "$GAMES_RESPONSE" | grep -o '"code":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$GAME_CODE" ]; then
    echo "Found game code: $GAME_CODE"
    
    # Test game validation
    VALIDATE_RESPONSE=$(curl -s "$API_URL/games/validate/$GAME_CODE" -H "x-auth-token: $MOBILE_DEVICE_ID")
    echo "Validation response: $VALIDATE_RESPONSE"
    
    if echo "$VALIDATE_RESPONSE" | grep -q '"valid":true'; then
        echo "✅ Game code validation successful"
        
        # Step 4: Test joining the game
        echo ""
        echo "4. Testing game join..."
        GAME_ID=$(echo "$VALIDATE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
        
        if [ -n "$GAME_ID" ]; then
            JOIN_RESPONSE=$(curl -s -X POST "$API_URL/games/$GAME_ID/join" \
                -H "Content-Type: application/json" \
                -H "x-auth-token: $MOBILE_DEVICE_ID" \
                -d '{"playerId": "'$PLAYER_ID'"}' 2>&1)
            
            echo "Join response: $JOIN_RESPONSE"
            
            if echo "$JOIN_RESPONSE" | grep -q '"success":true'; then
                echo "✅ Game join successful"
            else
                echo "❌ Game join failed"
                echo "Response: $JOIN_RESPONSE"
            fi
        else
            echo "❌ Could not extract game ID"
        fi
    else
        echo "❌ Game code validation failed"
        echo "Response: $VALIDATE_RESPONSE"
    fi
else
    echo "❌ No game codes found"
    echo "Creating a test game first..."
    
    # Create a test game
    CREATE_RESPONSE=$(curl -s -X POST "$API_URL/games" \
        -H "Content-Type: application/json" \
        -H "x-auth-token: device_vk73372ktty9e2y03otg" \
        -d '{"maxPlayers": 10, "publicGame": true}' 2>&1)
    
    echo "Create game response: $CREATE_RESPONSE"
    
    if echo "$CREATE_RESPONSE" | grep -q '"code"'; then
        NEW_GAME_CODE=$(echo "$CREATE_RESPONSE" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
        echo "Created game with code: $NEW_GAME_CODE"
        echo "Now try joining this game from mobile!"
    else
        echo "❌ Failed to create test game"
    fi
fi

echo ""
echo "🔍 Mobile join test complete!"
echo ""
echo "If there were errors, check:"
echo "1. Network connectivity to 192.168.0.87"
echo "2. CORS settings in server"
echo "3. Authentication middleware"
echo "4. Game validation logic"
