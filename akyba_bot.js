require('dotenv').config();
const fs = require('fs');
const { Telegraf } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();

// === Init bot & DB ===
const bot = new Telegraf(process.env.BOT_TOKEN);
const db = new sqlite3.Database('./database.db');

db.run(`
  CREATE TABLE IF NOT EXISTS verified_users (
    user_id INTEGER PRIMARY KEY,
    name TEXT,
    language TEXT,
    verified_at TEXT
  )
`);

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
  const emojis = ['🐶', '🐱', '🐵', '🐸', '🐼'];
  const shuffled = emojis.sort(() => 0.5 - Math.random());
  const correct = shuffled[0];
  return {
    correct,
    keyboard: shuffled.map(e => [{ text: e, callback_data: `captcha_${userId}_${e}` }])
  };
}

// === /start command for bot test
bot.start(ctx => {
  console.log('✅ /start triggered');
  ctx.reply('👋 Akyba Bot is alive and running!');
});

// === Catch all messages (debug)
bot.on('message', ctx => {
  console.log('📩 Message received:', ctx.message.text || '[non-text]');
});

// === New member joins
bot.on('new_chat_members', async ctx => {
  const user = ctx.message.new_chat_members[0];
  const name = user.first_name;
  const userId = user.id;
  const chatId = ctx.chat.id;

  const lang = ['fr', 'en'].includes(ctx.from.language_code) ? ctx.from.language_code : 'en';
  const T = i18n[lang];

  console.log(`👤 New member detected: ${name} (${userId}) in chat ${chatId}`);

  const { correct, keyboard } = generateCaptcha(userId);

  pending.set(userId, {
    correct,
    timeout: setTimeout(async () => {
      try {
        await ctx.kickChatMember(userId);
        await ctx.reply(T.timeoutKick(name));
        console.log(`⛔ ${name} kicked for not verifying`);
      } catch (e) {
        console.warn(`❌ Kick failed for ${name}:`, e.message);
      }
      pending.delete(userId);
    }, 60_000)
  });

  try {
    await ctx.restrictChatMember(userId, { can_send_messages: false });
    console.log(`🔒 User ${name} restricted`);
  } catch (e) {
    console.warn(`❌ Restrict failed:`, e.message);
  }

  await ctx.replyWithPhoto(
    { source: './akyba-logo.png' },
    {
      caption: T.welcome(name),
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    }
  );
});

// === CAPTCHA verification
bot.on('callback_query', async ctx => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name;
  const data = ctx.callbackQuery.data;
  const lang = ['fr', 'en'].includes(ctx.from.language_code) ? ctx.from.language_code : 'en';
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

    await ctx.restrictChatMember(userId, {
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true
    });

    db.run(`
      INSERT OR REPLACE INTO verified_users (user_id, name, language, verified_at)
      VALUES (?, ?, ?, datetime('now'))
    `, [userId, userName, lang]);

    console.log(`✅ ${userName} verified successfully`);
    await ctx.answerCbQuery("✅ Verified!");
    await ctx.reply(T.verifySuccess(userName));
  } else {
    await ctx.answerCbQuery(T.verifyFail, { show_alert: true });
  }
});

// === Launch bot
console.log("🤖 Akyba Bot is launching...");
bot.launch().then(() => {
  console.log("✅ Akyba Bot is running with CAPTCHA, DB logging, and multilingual support.");
}).catch(console.error);

// === Graceful shutdown
process.on('SIGINT', () => {
  bot.stop('SIGINT');
  db.close();
  console.log("🛑 Akyba Bot stopped (SIGINT)");
});
process.on('SIGTERM', () => {
  bot.stop('SIGTERM');
  db.close();
  console.log("🛑 Akyba Bot stopped (SIGTERM)");
});
