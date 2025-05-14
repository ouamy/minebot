# minebot

**minebot** is an anti-AFK Minecraft bot designed to keep your Aternos server online 24/7. It automatically connects to your server and prevents it from shutting down due to inactivity.

---

## Features

- Keeps Aternos Minecraft servers online continuously
- Simple configuration via `.env` file
- Lightweight and customizable

---

## Setup

### 1. Clone the repository
```bash
git clone https://github.com/ouamy/minebot.git
cd minebot
```

### 2. Install dependencies
```bash
npm install
npm install mineflayer mineflayer-pathfinder
```

### 3. Create a `.env` file
Create a `.env` file in the root directory with the following content:
```bash
ATERNOS_USER=your_user
ATERNOS_PASSWORD=your_password
HOST_NAME=localhost
PORT=3000
API_PASSWORD=strong_password
TOKEN_KEY=vulnerable_token_key
PUBLIC_START=false
PUBLIC_INFO=false
DEBUG=false
```
---
## Usage
To start the bot:
```bash
node main.js
```
