#!/bin/bash

echo "🔍 DEBUGGING GAME DATA STRUCTURE"
echo "================================="

# Create a game and add test players
echo "1. Creating a new game..."
GAME_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -H "x-auth-token: device_vk73372ktty9e2y03otg" -d '{"maxPlayers":10,"publicGame":true}' "http://localhost:5000/api/games")

if [ $? -eq 0 ] && [ ! -z "$GAME_RESPONSE" ]; then
    echo "✅ Game creation successful"
    
    # Extract game ID
    GAME_ID=$(echo "$GAME_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    echo "Game ID: $GAME_ID"
    
    if [ ! -z "$GAME_ID" ]; then
        echo ""
        echo "2. Adding test players..."
        TEST_PLAYERS_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -H "x-auth-token: device_vk73372ktty9e2y03otg" -d '{"count":2}' "http://localhost:5000/api/games/$GAME_ID/test-players")
        
        if [ $? -eq 0 ] && [ ! -z "$TEST_PLAYERS_RESPONSE" ]; then
            echo "✅ Test players added successfully"
            echo ""
            echo "3. Checking game data structure..."
            
            GAME_DATA=$(curl -s -H "x-auth-token: device_vk73372ktty9e2y03otg" "http://localhost:5000/api/games/$GAME_ID")
            
            if [ $? -eq 0 ] && [ ! -z "$GAME_DATA" ]; then
                echo "✅ Game data retrieved"
                echo ""
                echo "=== FULL GAME DATA ==="
                echo "$GAME_DATA" | python3 -m json.tool 2>/dev/null || echo "$GAME_DATA"
                echo ""
                echo "=== PLAYERS ARRAY STRUCTURE ==="
                echo "$GAME_DATA" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if 'data' in data and 'players' in data['data']:
        players = data['data']['players']
        print(f'Players count: {len(players)}')
        for i, player in enumerate(players):
            print(f'Player {i}:')
            for key, value in player.items():
                print(f'  {key}: {value}')
            print()
    else:
        print('No players data found in response')
except Exception as e:
    print(f'Error parsing JSON: {e}')
" 2>/dev/null || echo "Python JSON parsing failed, raw data above"
            else
                echo "❌ Failed to retrieve game data"
            fi
        else
            echo "❌ Failed to add test players"
        fi
    else
        echo "❌ Could not extract game ID"
    fi
else
    echo "❌ Game creation failed"
fi

echo ""
echo "🔍 Debugging complete!"
