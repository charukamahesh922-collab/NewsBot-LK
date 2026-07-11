# 📰 NewsBot-LK

<div align="center">
  <h3>🇱🇰 Sri Lanka's Most Complete WhatsApp News Bot</h3>
  <p>Automated news delivery from 10 sources directly to your WhatsApp group</p>

  <img src="Assetes/botnews.png" width="300" height="300">
  
  ![Version](https://img.shields.io/badge/version-2.0.0-maroon)
  ![License](https://img.shields.io/badge/license-MIT-gold)
  ![Platform](https://img.shields.io/badge/platform-WhatsApp-green)
  ![Status](https://img.shields.io/badge/status-active-brightgreen)
</div>

---

## 📡 News Sources (10)

| Source | Categories | Language |
|--------|-----------|----------|
| 🇱🇰 **Hiru News** | Breaking, Main, Trending, International, Entertainment, Business | Sinhala |
| 🔴 **Derana News** | Hot News | Sinhala |
| 🟢 **Esana News** | Latest News (Helakuru) | Sinhala |
| 📰 **AdaDerana** | Latest News (RSS) | English/Sinhala |
| ⚡ **FlashNews** | Latest News | Sinhala |
| 🌍 **BBC Sinhala** | Latest News | Sinhala |
| 📰 **Ada.lk** | Latest News | Sinhala |
| 📰 **Newswire** | Latest News | English |
| 📺 **Sirasa** | Latest News | Sinhala |
| 🏏 **Cricket** | ESPN Cricinfo + Sinhala Cricket | English/Sinhala |

---

## ✨ Features

- 🔄 **Auto-fetch** news every 1 minute
- 📝 **Full descriptions** - no truncation
- 🖼️ **Images** with every news article
- 😎 **Auto-reactions** (random emojis)
- 👁️ **Status Auto-View & React**
- 💾 **Media Save** (/save command)
- 🎯 **Duplicate detection**
- 📋 **Bot commands** - `/menu` `/news` `/stats` `/save`
- ☁️ **24/7 cloud hosting** (FREE)
- 📱 **WhatsApp Web** based

---

## 📋 Bot Commands

| Command | Description |
|---------|-------------|
| `/menu` | Show bot menu |
| `/news` | Fetch latest news now |
| `/stats` | Show statistics |
| `/save` | Reply to media to save |

---

## 🚀 Deploy Your Own Bot - FREE

| Platform | Free Tier | Difficulty |
|----------|-----------|------------|
| 🟢 **KataBump** | ✅ Yes | Easy ⭐ |
| 🔵 **Render** | ✅ Yes (720h/mo) | Easy ⭐ |
| 🟠 **Koyeb** | ✅ Yes | Medium ⭐⭐ |
| 🟣 **Heroku** | ❌ Paid only | Medium ⭐⭐ |

---

### 🟢 KataBump (Easiest - Free 24/7)

1. **Fork this repository** on GitHub
2. Edit `index.js` - change `GROUP_JID`
3. Go to **[KataBump.com](https://katabump.com)** → Sign Up
4. **Create New App** → Connect your forked repo
5. Set **Environment Variables**: `GROUP_JID = your_group_jid@g.us` / `CHECK_INTERVAL_MS = 60000`
6. Click **Deploy**
7. Scan QR code from logs with WhatsApp

---

### 🔵 Render (Free - 720h/month)

1. **Fork this repository** on GitHub
2. Go to **[Render.com](https://render.com)** → Sign Up
3. Click **New + → Web Service** → Connect repo
4. Configure: `Runtime: Node` / `Build: npm install` / `Start: node index.js`
5. Add **Environment Variables**: `GROUP_JID` / `CHECK_INTERVAL_MS`
6. Click **Create Web Service** → Scan QR

---

### 🟠 Koyeb (Free)

1. **Fork this repository** on GitHub
2. Go to **[Koyeb.com](https://koyeb.com)** → Sign Up
3. **Create App** → GitHub → Configure: `Port: 3000` / `Run: node index.js`
4. Add **Environment Variables** → Deploy → Scan QR

---

### 🟣 Heroku (Paid)

```bash
heroku login && heroku create newsbot-lk
heroku config:set GROUP_JID=your_group_jid@g.us CHECK_INTERVAL_MS=60000
git push heroku main && heroku ps:scale web=1 && heroku logs --tail
```
📦 Run Locally

````
git clone https://github.com/charukamahesh922-collab/NewsBot-LK.git
cd NewsBot-LK && npm install
# Edit GROUP_JID in index.js
node index.js
````
