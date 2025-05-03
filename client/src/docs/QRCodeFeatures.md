# QR Code Features

This document provides an overview of the QR code generation and scanning functionality in the QuizGame application.

## Overview

The QR code features allow game hosts to generate QR codes for their game sessions, which players can scan to quickly join games. This improves the user experience by eliminating the need to manually enter game codes.

## Features

### For Game Hosts

1. **QR Code Generation**: Each game session automatically gets a unique QR code that encodes the game join URL.
2. **QR Code Display Page**: A dedicated page to display the QR code for a game session.
3. **Download Option**: Hosts can download the QR code as a PNG image for sharing or printing.
4. **Print Option**: Direct printing of the QR code page with instructions for players.

### For Players

1. **QR Code Scanning**: Players can scan QR codes using their device camera.
2. **Direct Join**: After scanning, players are taken directly to the game join page.
3. **Camera Controls**: Players can switch cameras and toggle the flashlight when scanning.
4. **Fallback Option**: Manual game code entry is still available if scanning isn't possible.

## How to Use

### As a Game Host

1. Create a new game session.
2. Navigate to the QR code page for your game session at `/qr-code/:gameId`.
3. Display the QR code to players, or download/print it for distribution.
4. Players who scan the QR code will be automatically directed to join your game.

### As a Player

1. From the home page, click "Scan QR Code".
2. Allow camera access when prompted.
3. Point your camera at the game's QR code.
4. Once scanned, you'll be taken to the join page with the game code pre-filled.
5. Enter your name and join the game.

## Technical Implementation

### Server-Side

- QR codes are generated using the `qrcode` npm package.
- The server provides endpoints for generating QR codes in different formats (data URL, SVG, PNG).
- Game codes are validated before allowing players to join.

### Client-Side

- QR code display uses the `qrcode.react` library.
- QR code scanning uses the `html5-qrcode` library.
- The application supports both front and back cameras for scanning.
- Flashlight control is available on supported devices.

## Best Practices

1. **Display Size**: When displaying QR codes for scanning, ensure they are large enough (at least 200x200 pixels).
2. **Lighting**: Good lighting conditions improve scanning success rates.
3. **Alternative**: Always provide the game code as a fallback option for manual entry.
4. **Testing**: Test QR code scanning on various devices and browsers to ensure compatibility.

## Troubleshooting

- **Camera Access Issues**: Ensure the browser has permission to access the camera.
- **Scanning Problems**: Make sure the QR code is well-lit and the entire code is visible in the camera view.
- **Code Validation Errors**: If a code doesn't work, try entering it manually as a fallback.
