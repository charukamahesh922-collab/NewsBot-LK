# 📰 NewsBot-LK

<div align="center">
  <h3>🇱🇰 Sri Lanka's Most Complete WhatsApp News Bot</h3>
  <p>Automated news delivery from 4 sources directly to your WhatsApp group</p>
  
  ![Version](https://img.shields.io/badge/version-2.0.0-maroon)
  ![License](https://img.shields.io/badge/license-MIT-gold)
  ![Platform](https://img.shields.io/badge/platform-WhatsApp-green)
  ![Status](https://img.shields.io/badge/status-active-brightgreen)
</div>

---

## 📡 News Sources

| Source | Categories | Language |
|--------|-----------|----------|
| 🇱🇰 **Hiru News** | Breaking, Main, Trending, International, Entertainment, Business | Sinhala |
| 🔴 **Derana News** | Hot News | Sinhala |
| 🏏🇱🇰 **Sinhala Cricket** | Cricket News | Sinhala |
| 🏏🌍 **English Cricket** | ESPN Cricinfo | English |

---

## ✨ Features

- 🔄 **Auto-fetch** news every 2 minutes
- 📝 **Full descriptions** - no truncation
- 🖼️ **Images** with every news article
- 😎 **Auto-reactions** (random emojis)
- 🎯 **Duplicate detection** - never sends same news twice
- 📋 **Bot commands** - `/menu` `/news` `/info` `/stats`
- ☁️ **24/7 cloud hosting** (FREE options available)
- 📱 **WhatsApp Web** based - no phone needed after setup

---

## 📋 Bot Commands

| Command | Description |
|---------|-------------|
| `/menu` | Show full bot menu with all features |
| `/news` | Fetch and send latest news immediately |
| `/info` | Display bot information and credits |
| `/stats` | Show how many articles sent so far |

---

## 🚀 Deploy Your Own Bot - 4 FREE Options

Choose any platform below to deploy your bot 24/7 for FREE:

| Platform | Free Tier | Uptime | Difficulty |
|----------|-----------|--------|------------|
| 🟢 **KataBump** | ✅ Yes | 24/7 | Easy ⭐ |
| 🟣 **Heroku** | ❌ Paid only | 24/7 | Medium ⭐⭐ |
| 🔵 **Render** | ✅ Yes (720h/mo) | 24/7 | Easy ⭐ |
| 🟠 **Koyeb** | ✅ Yes | 24/7 | Medium ⭐⭐ |

---

### 📋 Prerequisites (All Platforms)
- GitHub account (free)
- WhatsApp account (scan QR once)

---

## 🟢 Option 1: KataBump (Easiest)

**Best for beginners - completely free 24/7**

1. **Fork this repository** on GitHub
2. Edit `index.js` - change `GROUP_JID`
3. Go to **[KataBump.com](https://katabump.com)** → Sign Up
4. **Create New App** → Connect your forked repo
5. Set **Environment Variables**:

````
GROUP_JID = your_group_jid@g.us
CHECK_INTERVAL_MS = 120000
````

6. Click **Deploy**
7. Scan QR code from logs with WhatsApp

✅ **Done! Free 24/7 hosting!**

---

## 🔵 Option 2: Render (Easy)

**Free tier: 720 hours/month (enough for 24/7)**

1. **Fork this repository** on GitHub
2. Go to **[Render.com](https://render.com)** → Sign Up
3. Click **New + → Web Service**
4. Connect your forked GitHub repo
5. Configure:

````
Name: newsbot-lk
Runtime: Node
Build Command: npm install
Start Command: node index.js
````

6. Add **Environment Variables**:

````
GROUP_JID = your_group_jid@g.us
CHECK_INTERVAL_MS = 120000
````

7. Click **Create Web Service**
8. Scan QR code from logs

✅ **Done! Free for 720 hours/month!**

---

## 🟠 Option 3: Koyeb (Medium)

**Free tier: 1 web service + 1 worker**

1. **Fork this repository** on GitHub
2. Go to **[Koyeb.com](https://koyeb.com)** → Sign Up
3. Click **Create App**
4. Choose **GitHub** → Select your forked repo
5. Configure:

````
Type: Web Service
Port: 3000
Run command: node index.js
````

6. Add **Environment Variables**:

````
GROUP_JID = your_group_jid@g.us
CHECK_INTERVAL_MS = 120000
````

7. Click **Deploy**
8. Scan QR code from logs

✅ **Done! Free tier deployed!**

---

## 🟣 Option 4: Heroku (Paid)

**Note: Heroku no longer has free tier**

1. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. Login: `heroku login`
3. Create app: `heroku create newsbot-lk`
4. Set environment variables:
```
heroku config:set GROUP_JID=your_group_jid@g.us
heroku config:set CHECK_INTERVAL_MS=120000
```

    Deploy: git push heroku main

    Scale: heroku ps:scale web=1

    Check logs: heroku logs --tail

    Scan QR code from logs

✅ Done! (Requires paid dyno)

📦 Run Locally (Without Cloud)

````
# Clone the repo
git clone https://github.com/YOUR_USERNAME/NewsBot-LK.git
cd NewsBot-LK

# Install dependencies
npm install

# Edit GROUP_JID in index.js
nano index.js

# Run the bot
node index.js

# Scan QR code with WhatsApp
# Bot runs as long as your PC is on

````
