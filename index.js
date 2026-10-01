const express = require('express');
const cors = require('cors');
const db = require('./db');
const { bot, createInvoiceLink } = require('./bot');

const app = express();
app.use(cors());
app.use(express.json());

const ADMIN_ID = 7426568885;

// ==== API для Mini App ====

// Получить все товары
app.get('/api/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  res.json(products);
});

// Получить профиль пользователя
app.get('/api/user/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json(user);
});

// Создать заказ + уведомить админа
app.post('/api/order', (req, res) => {
  const { userId, items, total } = req.body;

  const info = db.prepare(
    'INSERT INTO orders (user_id, items, total) VALUES (?, ?, ?)'
  ).run(userId, JSON.stringify(items), total);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const userName = user
    ? (user.first_name || '') + ' ' + (user.last_name || '') + ' (@' + (user.username || 'нет') + ')'
    : 'ID ' + userId;

  let msg = '🛒 <b>Новый заказ!</b>\n\n';
  msg += '👤 Покупатель: ' + userName + '\n';
  msg += '🆔 ID: ' + userId + '\n\n';
  msg += '<b>Товары:</b>\n';
  items.forEach(i => {
    const variant = i.optionLabel ? ' (' + i.optionLabel + ')' : '';
    msg += '• ' + i.name + variant + ' × ' + i.qty + ' = ' + (i.price * i.qty) + ' ⭐\n';
  });
  msg += '\n💰 <b>Итого: ' + total + ' ⭐</b>';

  bot.sendMessage(ADMIN_ID, msg, { parse_mode: 'HTML' })
    .catch(err => console.error('Ошибка отправки админу:', err));

  res.json({ ok: true, orderId: info.lastInsertRowid });
});

// Создать ссылку на оплату звёздами
app.post('/api/pay', async (req, res) => {
  try {
    const { userId, amount, title } = req.body;
    const link = await createInvoiceLink(
      title || 'Пополнение баланса',
      'Оплата в Krayv Shop',
      'user_' + userId + '_' + Date.now(),
      Math.round(amount)
    );
    res.json({ invoiceLink: link });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==== API для админки ====

app.get('/api/admin/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

app.post('/api/admin/balance', (req, res) => {
  const { userId, amount } = req.body;
  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, userId);
  res.json({ ok: true });
});

app.get('/api/admin/orders', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  res.json(orders);
});

// ==== Раздача admin.html ====
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/admin.html');
});

// ==== Главная ====
app.get('/', (req, res) => {
  res.send('Krayv Server is alive!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server started on port ' + PORT));
