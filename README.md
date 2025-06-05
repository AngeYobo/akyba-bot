# 🤖 Akyba Bot

**Akyba Bot** is a professional Telegram bot built for the [Akyba Web3](https://akyba.io) community.  
It secures group chats by verifying new users with an emoji-based CAPTCHA and sending a multilingual welcome message with branding and project links.

---

## ✨ Features

- 🖼️ Branded welcome image (Akyba logo)
- 🔐 Emoji CAPTCHA to verify new members
- ⏳ Auto-kick users who don’t verify within 60 seconds
- 🗃️ Stores verified users in a local SQLite database
- 🌍 French 🇫🇷 and English 🇬🇧 language support
- 🧑‍💻 Ready for deployment via Railway / Render

---

## 🚀 Quick Start (Local)

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/akyba-bot.git
cd akyba-bot
````

### 2. Install dependencies

```bash
pnpm install
```

### 3. Create a `.env` file

```env
BOT_TOKEN=your_telegram_bot_token
```

### 4. Add your logo

Place your Akyba logo image in the project folder and name it:

```bash
akyba-logo.png
```

### 5. Run the bot

```bash
node index.js
```

---

## ☁️ Deployment on Railway

1. Push this repo to GitHub
2. Go to [https://railway.app](https://railway.app)
3. Create a new project from your GitHub repo
4. Set the environment variable:

   * `BOT_TOKEN=your_telegram_token`
5. Set the start command: `node index.js`
6. Click **Deploy**

---

## 📁 Project Structure

```
akyba-bot/
├── index.js          # Main bot logic
├── akyba-logo.png    # Welcome image
├── database.db       # SQLite database (auto-generated)
├── .env              # Environment variables (not committed)
├── package.json
├── .gitignore
```

---

## 🛡️ Security Notes

* The `.env` file must **never be committed** to GitHub.
* Use environment variables in Railway or Render for safe secrets storage.

---

## 📜 License

MIT – Made with ❤️ for the Akyba community.
