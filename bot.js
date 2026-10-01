const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = 7426568885;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

async function saveUser(user) {
  let photoUrl = null;
  try {
    const photos = await bot.getUserProfilePhotos(user.id, { limit: 1 });
    if (photos.total_count > 0) {
      const fileId = photos.photos[0][0].file_id;
      const file = await bot.getFile(fileId);
      photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    }
  } catch (e) {}

  db.prepare(`
    INSERT INTO users (id, username, first_name, last_name, photo_url, is_admin)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username=excluded.username,
      first_name=excluded.first_name,
      last_name=excluded.last_name,
      photo_url=excluded.photo_url
  `).run(
    user.id,
    user.username || null,
    user.first_name || null,
    user.last_name || null,
    photoUrl,
    user.id === ADMIN_ID ? 1 : 0
  );
}

bot.onText(/\/start/, async (msg) => {
  await saveUser(msg.from);
  bot.sendMessage(msg.chat.id, 'Привет! Открой Krayv Shop кнопкой меню 👇');
});

bot.on('message', async (msg) => {
  if (!msg.from) return;
  await saveUser(msg.from);
});

async function createInvoiceLink(title, description, payload, price) {
  return await bot.createInvoiceLink(
    title,
    description,
    payload,
    "",
    "XTR",
    [{ label: title, amount: price }]
  );
}

bot.on('pre_checkout_query', (query) => {
  bot.answerPreCheckoutQuery(query.id, true);
});

bot.on('successful_payment', (msg) => {
  const userId = msg.from.id;
  const amount = msg.successful_payment.total_amount;
  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, userId);
  bot.sendMessage(userId, `✅ Оплата прошла! Зачислено ${amount} ⭐`);
});

module.exports = { bot, createInvoiceLink };