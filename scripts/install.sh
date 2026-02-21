#!/bin/bash
# Crewly installer — one-liner install script
#
# Usage:
#   curl -fsSL https://crewly.stevesprompt.com/install.sh | bash
#
# What it does:
#   1. Detects OS (macOS / Linux only)
#   2. Ensures Node.js >= 18 is available (offers nvm install if missing)
#   3. Installs crewly globally via npm
#   4. Runs `crewly onboard` to complete interactive setup

set -euo pipefail

# ========================= Colors =========================

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ========================= Banner =========================

echo ""
echo -e "${CYAN}"
echo "   ____                    _"
echo "  / ___|_ __ _____      _| |_   _"
echo " | |   | '__/ _ \\ \\ /\\ / / | | | |"
echo " | |___| | |  __/\\ V  V /| | |_| |"
echo "  \\____|_|  \\___| \\_/\\_/ |_|\\__, |"
echo "                              |___/"
echo -e "${NC}"
echo -e "${BOLD}  Quick Install${NC}"
echo ""

# ========================= OS Detection =========================

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    echo -e "${GREEN}  ✓ macOS detected (${ARCH})${NC}"
    ;;
  Linux)
    echo -e "${GREEN}  ✓ Linux detected (${ARCH})${NC}"
    ;;
  *)
    echo -e "${RED}  ✗ Unsupported OS: ${OS}${NC}"
    echo -e "  Use ${CYAN}npm install -g crewly${NC} instead."
    exit 1
    ;;
esac

# ========================= Node.js Check =========================

MIN_NODE_VERSION=18

check_node() {
  if command -v node &>/dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -ge "$MIN_NODE_VERSION" ]; then
      echo -e "${GREEN}  ✓ Node.js $(node -v) detected${NC}"
      return 0
    else
      echo -e "${YELLOW}  ⚠ Node.js $(node -v) is too old (need >= ${MIN_NODE_VERSION})${NC}"
      return 1
    fi
  else
    echo -e "${YELLOW}  ⚠ Node.js not found${NC}"
    return 1
  fi
}

install_node_via_nvm() {
  echo -e "${BLUE}  Installing Node.js via nvm...${NC}"

  # Check if nvm is already installed
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    echo -e "${BLUE}  Installing nvm...${NC}"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  fi

  # Load nvm
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

  nvm install --lts
  nvm use --lts

  echo -e "${GREEN}  ✓ Node.js $(node -v) installed via nvm${NC}"
}

if ! check_node; then
  echo ""
  echo -e "  Node.js >= ${MIN_NODE_VERSION} is required."
  echo -e "  Would you like to install Node.js via nvm? [Y/n] "
  read -r REPLY
  REPLY="${REPLY:-Y}"

  if [[ "$REPLY" =~ ^[Yy]$ ]] || [[ -z "$REPLY" ]]; then
    install_node_via_nvm
  else
    echo -e "${RED}  ✗ Node.js is required. Install it from https://nodejs.org${NC}"
    exit 1
  fi
fi

echo ""

# ========================= npm Check =========================

if ! command -v npm &>/dev/null; then
  echo -e "${RED}  ✗ npm not found. It should come with Node.js.${NC}"
  echo -e "  Please reinstall Node.js from https://nodejs.org"
  exit 1
fi

# ========================= Install Crewly =========================

echo -e "${BLUE}  Installing Crewly...${NC}"

if npm install -g crewly; then
  echo -e "${GREEN}  ✓ Crewly installed${NC}"
else
  echo -e "${RED}  ✗ Failed to install Crewly.${NC}"
  echo -e "  Try running: ${CYAN}sudo npm install -g crewly${NC}"
  exit 1
fi

echo ""

# ========================= Run Onboarding =========================

echo -e "${BLUE}  Launching setup wizard...${NC}"
echo ""

crewly onboard
