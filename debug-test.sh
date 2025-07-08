#!/bin/bash

echo "🔍 DEBUGGING TEST PLAYERS ISSUE"
echo "================================"

# Check if services are running
echo "1. Checking PM2 services..."
pm2 status

echo ""
echo "2. Checking if server is responding..."
timeout 5 curl -s http://localhost:5000/ || echo "❌ Server not responding"

echo ""
echo "3. Checking if client is responding..."
timeout 5 curl -s http://localhost:5173/ | head -c 100 || echo "❌ Client not responding"

echo ""
echo "4. Testing player authentication..."
timeout 5 curl -s -H "x-auth-token: device_vk73372ktty9e2y03otg" "http://localhost:5000/api/players" || echo "❌ Player auth failed"

echo ""
echo "5. Creating a test game..."
GAME_RESPONSE=$(timeout 10 curl -s -X POST -H "Content-Type: application/json" -H "x-auth-token: device_vk73372ktty9e2y03otg" -d '{"maxPlayers":10,"publicGame":true}' "http://localhost:5000/api/games" 2>/dev/null)

if [ $? -eq 0 ] && [ ! -z "$GAME_RESPONSE" ]; then
    echo "✅ Game creation successful"
    echo "Response: $GAME_RESPONSE"
    
    # Extract game ID
    GAME_ID=$(echo "$GAME_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    echo "Game ID: $GAME_ID"
    
    if [ ! -z "$GAME_ID" ]; then
        echo ""
        echo "6. Adding test players..."
        TEST_PLAYERS_RESPONSE=$(timeout 10 curl -s -X POST -H "Content-Type: application/json" -H "x-auth-token: device_vk73372ktty9e2y03otg" -d '{"count":2}' "http://localhost:5000/api/games/$GAME_ID/test-players" 2>/dev/null)
        
        if [ $? -eq 0 ] && [ ! -z "$TEST_PLAYERS_RESPONSE" ]; then
            echo "✅ Test players API successful"
            echo "Response: $TEST_PLAYERS_RESPONSE"
            
            echo ""
            echo "7. Checking game data after adding players..."
            GAME_DATA_RESPONSE=$(timeout 10 curl -s -H "x-auth-token: device_vk73372ktty9e2y03otg" "http://localhost:5000/api/games/$GAME_ID" 2>/dev/null)
            
            if [ $? -eq 0 ] && [ ! -z "$GAME_DATA_RESPONSE" ]; then
                echo "✅ Game data retrieval successful"
                echo "Response: $GAME_DATA_RESPONSE"
                
                # Count players
                PLAYER_COUNT=$(echo "$GAME_DATA_RESPONSE" | grep -o '"players":\[[^]]*\]' | grep -o '"id":"[^"]*"' | wc -l)
                echo "Players found: $PLAYER_COUNT"
                
                if [ "$PLAYER_COUNT" -ge 2 ]; then
                    echo "✅ Test players are present in database"
                else
                    echo "❌ Test players missing from database"
                fi
            else
                echo "❌ Game data retrieval failed"
            fi
        else
            echo "❌ Test players API failed"
        fi
    else
        echo "❌ Could not extract game ID"
    fi
else
    echo "❌ Game creation failed"
fi

echo ""
echo "8. Checking recent server logs..."
if [ -f "server/logs/server-out.log" ]; then
    echo "Recent server output:"
    tail -10 "server/logs/server-out.log"
else
    echo "❌ Server log file not found"
fi

echo ""
echo "9. Checking for socket event logs..."
if [ -f "server/logs/server-out.log" ]; then
    SOCKET_LOGS=$(tail -50 "server/logs/server-out.log" | grep -i "socket\|emit\|players")
    if [ ! -z "$SOCKET_LOGS" ]; then
        echo "Socket-related logs found:"
        echo "$SOCKET_LOGS"
    else
        echo "❌ No socket-related logs found"
    fi
fi

echo ""
echo "🔍 Debugging complete!"
