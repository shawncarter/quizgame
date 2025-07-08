# QuizGame Service Manager

This document explains how to use the QuizGame Service Manager script to run the server and client in the background with automatic restart capabilities.

## Overview

The QuizGame Service Manager uses PM2 (a process manager for Node.js applications) to run both the server and client in the background. This provides several benefits:

- Services run in the background, freeing up your terminal
- Automatic restart if a service crashes
- Automatic restart when code changes are detected
- Log management
- Process monitoring

## Prerequisites

- Node.js and npm installed
- PM2 installed globally (the script will install it if not present)

## Getting Started

The `quizgame.sh` script provides a simple interface to manage the QuizGame services.

### Basic Commands

1. **Start the services**:
   ```
   ./quizgame.sh start
   ```

2. **Stop the services**:
   ```
   ./quizgame.sh stop
   ```

3. **Restart the services**:
   ```
   ./quizgame.sh restart
   ```

4. **Check service status**:
   ```
   ./quizgame.sh status
   ```

5. **View logs for both services**:
   ```
   ./quizgame.sh logs
   ```

6. **View server logs only**:
   ```
   ./quizgame.sh server-logs
   ```

7. **View client logs only**:
   ```
   ./quizgame.sh client-logs
   ```

8. **Open PM2 monitoring dashboard**:
   ```
   ./quizgame.sh monitor
   ```

9. **Show help**:
   ```
   ./quizgame.sh help
   ```

## Service URLs

- Server: http://localhost:5000
- Client: http://localhost:5173

## Log Files

Logs are stored in the following locations:

- Server output: `server/logs/server-out.log`
- Server errors: `server/logs/server-error.log`
- Client output: `client/logs/client-out.log`
- Client errors: `client/logs/client-error.log`

## Automatic Restart

The services are configured to:

- Restart automatically if they crash
- Restart when code changes are detected
- Limit restart attempts to prevent excessive restarts

## Advanced PM2 Commands

If you need more control, you can use PM2 commands directly:

- List all processes: `pm2 list`
- Show process details: `pm2 show quizgame-server`
- Monitor CPU/Memory: `pm2 monit`
- View logs: `pm2 logs`
- Stop all processes: `pm2 stop all`
- Delete all processes: `pm2 delete all`

## Troubleshooting

If you encounter issues:

1. Check the logs: `./quizgame.sh logs`
2. Restart the services: `./quizgame.sh restart`
3. Stop and start the services: `./quizgame.sh stop` then `./quizgame.sh start`
4. Check PM2 status: `pm2 list`
5. Check MongoDB connection: `nc -zv localhost 27017`
