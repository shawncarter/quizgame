#!/bin/bash

# QuizGame Service Manager
# This script provides commands to manage the QuizGame server and client

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display usage information
show_usage() {
  echo -e "${BLUE}QuizGame Service Manager${NC}"
  echo -e "Usage: ./quizgame.sh [command]"
  echo
  echo "Commands:"
  echo -e "  ${GREEN}start${NC}       Start both server and client"
  echo -e "  ${GREEN}stop${NC}        Stop both server and client"
  echo -e "  ${GREEN}restart${NC}     Restart both server and client"
  echo -e "  ${GREEN}status${NC}      Show status of all services"
  echo -e "  ${GREEN}logs${NC}        Show logs for both services"
  echo -e "  ${GREEN}server-logs${NC} Show logs for server only"
  echo -e "  ${GREEN}client-logs${NC} Show logs for client only"
  echo -e "  ${GREEN}monitor${NC}     Open PM2 monitoring dashboard"
  echo -e "  ${GREEN}help${NC}        Show this help message"
  echo
  echo "Examples:"
  echo "  ./quizgame.sh start"
  echo "  ./quizgame.sh logs"
}

# Check if PM2 is installed
check_pm2() {
  if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}PM2 is not installed. Installing...${NC}"
    npm install -g pm2
    if [ $? -ne 0 ]; then
      echo -e "${RED}Failed to install PM2. Please install it manually with 'npm install -g pm2'${NC}"
      exit 1
    fi
    echo -e "${GREEN}PM2 installed successfully${NC}"
  fi
}

# Start services
start_services() {
  echo -e "${YELLOW}Starting QuizGame services...${NC}"
  pm2 start ecosystem.config.js
  echo -e "${GREEN}Services started. Use './quizgame.sh status' to check status${NC}"
  echo -e "${BLUE}Server URL: http://localhost:5000${NC}"
  echo -e "${BLUE}Client URL: http://localhost:5173${NC}"
}

# Stop services
stop_services() {
  echo -e "${YELLOW}Stopping QuizGame services...${NC}"
  pm2 stop ecosystem.config.js
  echo -e "${GREEN}Services stopped${NC}"
}

# Restart services
restart_services() {
  echo -e "${YELLOW}Restarting QuizGame services...${NC}"
  pm2 restart ecosystem.config.js
  echo -e "${GREEN}Services restarted${NC}"
}

# Show status
show_status() {
  echo -e "${YELLOW}QuizGame services status:${NC}"
  pm2 list | grep quizgame
  echo
  echo -e "${BLUE}Server URL: http://localhost:5000${NC}"
  echo -e "${BLUE}Client URL: http://localhost:5173${NC}"
}

# Show logs
show_logs() {
  echo -e "${YELLOW}Showing logs for all services (Ctrl+C to exit)...${NC}"
  pm2 logs
}

# Show server logs
show_server_logs() {
  echo -e "${YELLOW}Showing server logs (Ctrl+C to exit)...${NC}"
  pm2 logs quizgame-server
}

# Show client logs
show_client_logs() {
  echo -e "${YELLOW}Showing client logs (Ctrl+C to exit)...${NC}"
  pm2 logs quizgame-client
}

# Show monitor
show_monitor() {
  echo -e "${YELLOW}Opening PM2 monitoring dashboard...${NC}"
  pm2 monit
}

# Main script logic
check_pm2

# Process command line arguments
if [ $# -eq 0 ]; then
  show_usage
  exit 0
fi

case "$1" in
  start)
    start_services
    ;;
  stop)
    stop_services
    ;;
  restart)
    restart_services
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs
    ;;
  server-logs)
    show_server_logs
    ;;
  client-logs)
    show_client_logs
    ;;
  monitor)
    show_monitor
    ;;
  help)
    show_usage
    ;;
  *)
    echo -e "${RED}Unknown command: $1${NC}"
    show_usage
    exit 1
    ;;
esac

exit 0
