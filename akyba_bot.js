require('dotenv').config();
const fs = require('fs');
const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');
const sqlite3 = require('sqlite3').verbose();

// === Init bot & DB ===
const bot = new Telegraf(process.env.BOT_TOKEN);
const db = new sqlite3.Database('./database.db');

db.run(`CREATE TABLE IF NOT EXISTS verified_users (
  user_id INTEGER PRIMARY KEY,
  name TEXT,
  language TEXT,
  verified_at TEXT
);`);

const pending = new Map();

// === Language Translations ===
const i18n = {
  fr: {
    welcome: name => `👋 *Bienvenue ${name} dans la communauté Akyba !* 🇨🇮✨\n\nClique sur le bon emoji pour prouver que tu es humain 👇`,
    verifySuccess: name => `👏 Bienvenue ${name} ! Tu es maintenant vérifié.`,
    verifyFail: `❌ Mauvais choix. Essaie encore.`,
    timeoutKick: name => `⛔ ${name} a été expulsé pour absence de vérification.`,
  },
  en: {
    welcome: name => `👋 *Welcome ${name} to the Akyba community!* 🌍\n\nClick the correct emoji below to verify you are human 👇`,
    verifySuccess: name => `👏 Welcome ${name}! You are now verified.`,
    verifyFail: `❌ Wrong choice. Try again.`,
    timeoutKick: name => `⛔ ${name} was removed for not verifying.`,
  },
};

// === Generate Emoji CAPTCHA ===
function generateCaptcha(userId) {
  const emojis = ['🐶', '🐱', '🐵'];
  const correct = emojis[Math.floor(Math.random() * emojis.length)];

  return {
    correct,
    keyboard: emojis.map(e => [{
      text: e,
      callback_data: `captcha_${userId}_${e}`
    }])
  };
}

// === On New Member ===
bot.on(message('new_chat_members'), async (ctx) => {
  const user = ctx.message.new_chat_members[0];
  const name = user.first_name;
  const userId = user.id;
  const chatId = ctx.chat.id;
  const lang = ctx.message.from.language_code === 'fr' ? 'fr' : 'en';
  const T = i18n[lang];

  const { correct, keyboard } = generateCaptcha(userId);

  // Store correct emoji
  pending.set(userId, {
    correct,
    timeout: setTimeout(async () => {
      try {
        await ctx.kickChatMember(userId);
        await ctx.reply(T.timeoutKick(name));
      } catch (e) {
        console.warn('Kick failed:', e.message);
      }
      pending.delete(userId);
    }, 60000)
  });

  // Restrict user
  try {
    await ctx.restrictChatMember(userId, {
      can_send_messages: false,
    });
  } catch (e) {
    console.warn('Restrict failed:', e.message);
  }

  // Send image + emoji captcha
  await ctx.replyWithPhoto(
    { source: './akyba-logo.png' },
    {
      caption: T.welcome(name),
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    }
  );
});

// === On Button Click ===
bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name;
  const data = ctx.callbackQuery.data;
  const lang = ctx.from.language_code === 'fr' ? 'fr' : 'en';
  const T = i18n[lang];

  if (!data.startsWith('captcha_')) return;

  const [, targetId, selected] = data.split('_');
  if (parseInt(targetId) !== userId) {
    return ctx.answerCbQuery("❌ This isn't for you.", { show_alert: true });
  }

  const entry = pending.get(userId);
  if (!entry) return ctx.answerCbQuery("⏱ Expired or already verified.");

  if (selected === entry.correct) {
    clearTimeout(entry.timeout);
    pending.delete(userId);

    // Unrestrict
    await ctx.restrictChatMember(userId, {
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true
    });

    // Save to DB
    db.run(`INSERT OR REPLACE INTO verified_users (user_id, name, language, verified_at) VALUES (?, ?, ?, datetime('now'))`, [
      userId, userName, lang
    ]);

    await ctx.answerCbQuery("✅ Verified!");
    await ctx.reply(T.verifySuccess(userName));
  } else {
    await ctx.answerCbQuery(T.verifyFail, { show_alert: true });
  }
});

console.log("");
console.log("Wellcome to the Akyba Bot!");
console.log("");
console.log("🤖 Akyba Bot is running with emoji CAPTCHA, auto-kick, logging, and multi-language support.");
console.log("");
// === Launch ===
bot.launch().then(() => {
  console.log("🤖 Akyba Bot is running with emoji CAPTCHA, auto-kick, logging, and multi-language support.");
}).catch(console.error);
// Handle graceful shutdown
process.on('SIGINT', () => {
  bot.stop('SIGINT');
  db.close();
  console.log("🤖 Akyba Bot stopped gracefully.");
});
process.on('SIGTERM', () => {
  bot.stop('SIGTERM');
  db.close();
  console.log("🤖 Akyba Bot stopped gracefully.");
});
// Handle new member verification with CAPTCHA
// bot.on('new_chat_members', async (ctx) => {
//   const user = ctx.message.new_chat_members[0];
//   const name = user.first_name;  
//   const userId = user.id;
//   const chatId = ctx.chat.id;        
//   const lang = ctx.message.from.language_code === 'fr' ? 'fr' : 'en';
//   const T = i18n[lang];
//      