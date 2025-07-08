#!/bin/bash

echo "🔍 TESTING MOBILE ACCESS CONFIGURATION"
echo "======================================"

LOCAL_IP="192.168.0.87"

echo "1. Checking if services are running..."
echo ""

# Check PM2 status
echo "PM2 Status:"
pm2 status 2>/dev/null || echo "PM2 not running or not found"

echo ""
echo "2. Checking port bindings..."

# Check what's listening on the ports
echo "Port 5000 (Backend):"
netstat -tulpn 2>/dev/null | grep :5000 || echo "Nothing listening on port 5000"

echo ""
echo "Port 5173 (Frontend):"
netstat -tulpn 2>/dev/null | grep :5173 || echo "Nothing listening on port 5173"

echo ""
echo "3. Testing local access..."

# Test localhost access
echo "Testing localhost backend:"
timeout 5 curl -s http://localhost:5000/ && echo "✅ Localhost backend accessible" || echo "❌ Localhost backend not accessible"

echo ""
echo "Testing localhost frontend:"
timeout 5 curl -s http://localhost:5173/ | head -c 50 && echo "✅ Localhost frontend accessible" || echo "❌ Localhost frontend not accessible"

echo ""
echo "4. Testing network IP access..."

# Test network IP access
echo "Testing network backend (http://$LOCAL_IP:5000):"
timeout 5 curl -s http://$LOCAL_IP:5000/ && echo "✅ Network backend accessible" || echo "❌ Network backend not accessible"

echo ""
echo "Testing network frontend (http://$LOCAL_IP:5173):"
timeout 5 curl -s http://$LOCAL_IP:5173/ | head -c 50 && echo "✅ Network frontend accessible" || echo "❌ Network frontend not accessible"

echo ""
echo "5. Testing API endpoints..."

echo "Testing players API via network IP:"
timeout 5 curl -s -H "x-auth-token: device_vk73372ktty9e2y03otg" "http://$LOCAL_IP:5000/api/players" | head -c 100 && echo "✅ API accessible via network" || echo "❌ API not accessible via network"

echo ""
echo "6. Network configuration summary..."
echo ""
echo "For mobile devices to connect, use these URLs:"
echo "📱 Frontend: http://$LOCAL_IP:5173"
echo "📱 Backend:  http://$LOCAL_IP:5000"
echo ""
echo "QR Code should contain: http://$LOCAL_IP:5173/join/[GAME_CODE]"
echo ""

echo "7. Firewall check..."
# Check if firewall might be blocking
if command -v ufw >/dev/null 2>&1; then
    echo "UFW Status:"
    sudo ufw status 2>/dev/null || echo "Cannot check UFW status (need sudo)"
else
    echo "UFW not installed"
fi

echo ""
echo "8. WiFi network info..."
echo "Current IP address: $LOCAL_IP"
echo "Make sure your mobile device is on the same WiFi network!"

echo ""
echo "🔍 Testing complete!"
echo ""
echo "If mobile access still doesn't work:"
echo "1. Check that mobile device is on same WiFi"
echo "2. Try disabling firewall temporarily"
echo "3. Check router settings for device isolation"
echo "4. Try accessing http://$LOCAL_IP:5173 directly in mobile browser"
