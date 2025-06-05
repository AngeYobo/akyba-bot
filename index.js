require('dotenv').config();
const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Temporary in-memory store for unverified users
const pendingVerification = new Map();

bot.on(message('new_chat_members'), async (ctx) => {
  const member = ctx.message.new_chat_members[0];
  const name = member.first_name;
  const userId = member.id;
  const chatId = ctx.chat.id;

  const isFrench = ctx.message.from.language_code === 'fr';

  const welcomeText = isFrench
    ? `👋 *Bienvenue ${name} dans la communauté Akyba !* 🇨🇮✨\n\nClique sur le bouton ci-dessous pour prouver que tu es humain 👇`
    : `👋 *Welcome ${name} to the Akyba community!* 🌍\n\nClick the button below to prove you are human 👇`;

  const verifyButtonText = isFrench
    ? '✅ Je suis humain'
    : '✅ I am human';

  // Send CAPTCHA verification message
  const sentMsg = await ctx.replyWithPhoto(
    { source: './akyba-logo.png' },
    {
      caption: welcomeText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: verifyButtonText, callback_data: `verify_${userId}` }]
        ]
      }
    }
  );

  // Restrict user (no messages)
  try {
    await ctx.restrictChatMember(userId, {
      can_send_messages: false,
      can_send_media_messages: false,
      can_send_other_messages: false,
      can_add_web_page_previews: false
    });
  } catch (err) {
    console.warn('Restrict error:', err.description);
  }

  // Set 60s timeout to auto-kick
  const timeout = setTimeout(async () => {
    try {
      await ctx.kickChatMember(userId);
      console.log(`⛔ Kicked unverified user: ${name}`);
    } catch (err) {
      console.warn('Kick error:', err.description);
    }
    pendingVerification.delete(userId);
  }, 60000);

  pendingVerification.set(userId, timeout);
});

// Handle CAPTCHA button click
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;

  if (data === `verify_${userId}`) {
    // Unrestrict user
    try {
      await ctx.restrictChatMember(userId, {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true
      });

      await ctx.answerCbQuery('✅ Verified!');
      await ctx.reply(`👏 Welcome, ${ctx.from.first_name}! You are now verified.`);

      clearTimeout(pendingVerification.get(userId));
      pendingVerification.delete(userId);
    } catch (err) {
      console.warn('Unrestrict error:', err.description);
    }
  } else {
    await ctx.answerCbQuery('❌ This button is not for you.', { show_alert: true });
  }
});

bot.launch().then(() => {
  console.log('🤖 Akyba Bot is running with CAPTCHA + auto-kick + multi-language!');
}).catch((err) => {
  console.error('Error launching bot:', err);
});
