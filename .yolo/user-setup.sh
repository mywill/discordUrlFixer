#!/bin/bash
set -e

# --- Node.js via NVM ---
export NVM_DIR="$HOME/.nvm"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
. "$NVM_DIR/nvm.sh"

nvm install 22
nvm alias default 22

# --- pnpm ---
corepack enable
corepack prepare pnpm@latest --activate

# --- Persist paths in shell configs ---
{
  echo 'export NVM_DIR="$HOME/.nvm"'
  echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
} >> ~/.zshrc

{
  echo 'export NVM_DIR="$HOME/.nvm"'
  echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
} >> ~/.bashrc
