#!/bin/bash

# EasyLin — Automatic Installer for Ubuntu/Debian
# This script installs Docker, Docker Compose, and starts EasyLin.

set -e

# Colors for output
RED='\033[0-31m'
GREEN='\033[0-32m'
YELLOW='\033[1-33m'
NC='\033[0m' # No Color

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}   EasyLin — Linux Management Dashboard   ${NC}"
echo -e "${GREEN}==========================================${NC}"

# 1. Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (use sudo).${NC}"
  exit 1
fi

# 2. Check Dependencies
check_docker() {
  if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker is not installed.${NC}"
    read -p "Do you want to install Docker now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${GREEN}Installing Docker...${NC}"
      apt-get update
      apt-get install -y ca-certificates curl gnupg lsb-release
      mkdir -p /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
      apt-get update
      apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
      echo -e "${GREEN}Docker installed successfully.${NC}"
    else
      echo -e "${RED}Docker is required. Exiting.${NC}"
      exit 1
    fi
  else
    echo -e "${GREEN}✓ Docker is already installed.${NC}"
  fi
}

check_compose() {
  if ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}Docker Compose V2 is not installed.${NC}"
    echo -e "${GREEN}Installing Docker Compose...${NC}"
    apt-get update
    apt-get install -y docker-compose-plugin
    echo -e "${GREEN}Docker Compose installed successfully.${NC}"
  else
    echo -e "${GREEN}✓ Docker Compose is already installed.${NC}"
  fi
}

check_docker
check_compose

# 3. Setup Environment
if [ ! -f .env ]; then
  echo -e "${GREEN}Creating .env file...${NC}"
  if [ -f .env.example ]; then
    cp .env.example .env
    SECRET=$(openssl rand -hex 32)
    sed -i "s/generate-a-strong-secret-key-here/$SECRET/" .env
    echo -e "${GREEN}✓ .env file created with a fresh secret key.${NC}"
  else
    echo -e "${RED}Error: .env.example not found!${NC}"
    exit 1
  fi
fi

# 4. Start EasyLin
echo -e "${GREEN}Starting EasyLin...${NC}"
docker compose up -d --build

LOCAL_IP=$(hostname -I | awk '{print $1}')
EXTERNAL_IP=$(curl -s https://ifconfig.me || echo "N/A")

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}   EasyLin is now running!               ${NC}"
echo -e "${GREEN}   Local Access:    http://$LOCAL_IP:5050 ${NC}"
echo -e "${GREEN}   External Access: http://$EXTERNAL_IP:5050 ${NC}"
echo -e "${GREEN}==========================================${NC}"
echo -e "${YELLOW}Log in with your server username and password.${NC}"
