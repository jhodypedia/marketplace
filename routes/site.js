// routes/site.js
import { Router } from 'express';
import slugify from 'slugify';
import { pool } from '../db.js';
import { ensureAuth } from '../middleware/auth.js';
import { generateDynamicQRIS, generateQRImageToFile } from '../qris.js';

const router = Router();

router.get('/', async (req, res) => {
  const [[count]] = await pool.query('SELECT COUNT(*) as c FROM items WHERE published=1');
  const [items] = await pool.query(
    'SELECT i.*, c.name as category_name, c.slug as category_slug FROM items i LEFT JOIN categories c ON i.category_id=c.id WHERE i.published=1 ORDER BY i.created_at DESC LIMIT 12'
  );
  res.render('home', { title: 'Beranda', items, totalCount: count.c });
});

router.get('/items', async (req, res) => {
  const q = req.query.q || '';
  const cat = req.query.cat || '';
  let sql = 'SELECT i.*, c.name as category_name, c.slug as category_slug FROM items i LEFT JOIN categories c ON i.category_id=c.id WHERE i.published=1';
  const params = [];
  if (q) { sql += ' AND (i.title LIKE ? OR i.description LIKE ?)'; params.push(`%${q}%`,`%${q}%`); }
  if (cat) { sql += ' AND c.slug=?'; params.push(cat); }
  sql += ' ORDER BY i.created_at DESC';
  const [items] = await pool.query(sql, params);
  const [categories] = await pool.query('SELECT * FROM categories ORDER BY name');
  res.render('items/index', { title: 'Katalog', items, categories, q, cat });
});

router.get('/items/:slug', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT i.*, c.name as category_name FROM items i LEFT JOIN categories c ON i.category_id=c.id WHERE i.slug=? AND i.published=1',
    [req.params.slug]
  );
  if (!rows.length) return res.status(404).send('Item tidak ditemukan');
  res.render('items/show', { title: rows[0].title, item: rows[0] });
});

// Cart (session)
router.post('/cart/add', async (req, res) => {
  const { item_id, qty } = req.body;
  const [rows] = await pool.query('SELECT id, title, price FROM items WHERE id=? AND published=1', [item_id]);
  if (!rows.length) { req.flash('error', 'Item tidak ditemukan'); return res.redirect('/items'); }
  const item = rows[0];
  const quantity = Math.max(1, parseInt(qty || 1));
  if (!req.session.cart) req.session.cart = [];
  const existing = req.session.cart.find(x => x.item_id == item.id);
  if (existing) existing.qty += quantity;
  else req.session.cart.push({ item_id: item.id, title: item.title, price: Number(item.price), qty: quantity });
  req.flash('success', 'Item ditambahkan ke keranjang.');
  res.redirect('/cart');
});

router.get('/cart', (req, res) => {
  const cart = req.session.cart || [];
  const subtotal = cart.reduce((a,c)=> a + c.price*c.qty, 0);
  res.render('cart/index', { title: 'Keranjang', cart, subtotal });
});

router.post('/cart/remove', (req, res) => {
  const { item_id } = req.body;
  req.session.cart = (req.session.cart || []).filter(x => x.item_id != item_id);
  req.flash('success', 'Item dihapus dari keranjang.');
  res.redirect('/cart');
});

router.get('/checkout', ensureAuth, (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) { req.flash('error','Keranjang kosong.'); return res.redirect('/cart'); }
  const subtotal = cart.reduce((a,c)=> a + c.price*c.qty, 0);
  res.render('checkout/index', { title: 'Checkout', cart, subtotal, feePercent: Number(process.env.PLATFORM_FEE || 0.5) });
});

router.post('/checkout', ensureAuth, async (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) { req.flash('error','Keranjang kosong.'); return res.redirect('/cart'); }
  const feePercent = Number(process.env.PLATFORM_FEE || 0.5);
  const subtotal = cart.reduce((a,c)=> a + c.price*c.qty, 0);
  const feeAmount = Math.round(subtotal * (feePercent/100));
  const grand = subtotal + feeAmount;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [orderRes] = await conn.query(
      'INSERT INTO orders (user_id,total_amount,fee_percent,fee_amount,grand_total,status) VALUES (?,?,?,?,?,?)',
      [req.session.user.id, subtotal, feePercent, feeAmount, grand, 'pending']
    );
    const orderId = orderRes.insertId;

    for (const it of cart) {
      const subtotalLine = it.price * it.qty;
      await conn.query(
        'INSERT INTO order_items (order_id,item_id,title_snapshot,price,quantity,subtotal) VALUES (?,?,?,?,?,?)',
        [orderId, it.item_id, it.title, it.price, it.qty, subtotalLine]
      );
    }

    const qrisPayload = generateDynamicQRIS(process.env.QRIS_STATIC, grand);
    const qrImagePath = await generateQRImageToFile(qrisPayload, `order-${orderId}`);

    await conn.query(
      'INSERT INTO payments (order_id, method, amount, status, qris_payload, qr_image_path) VALUES (?,?,?,?,?,?)',
      [orderId, 'qris', grand, 'unpaid', qrisPayload, qrImagePath]
    );
    await conn.query('UPDATE orders SET qris_payload=? WHERE id=?', [qrisPayload, orderId]);

    await conn.commit();
    req.session.cart = [];
    res.redirect(`/orders/${orderId}`);
  } catch (e) {
    await conn.rollback();
    console.error(e);
    req.flash('error', 'Gagal membuat order.');
    res.redirect('/checkout');
  } finally {
    conn.release();
  }
});

router.get('/orders/:id', ensureAuth, async (req, res) => {
  const [orders] = await pool.query('SELECT * FROM orders WHERE id=? AND user_id=?', [req.params.id, req.session.user.id]);
  if (!orders.length) return res.status(404).send('Order tidak ditemukan');
  const order = orders[0];
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id=?', [order.id]);
  const qrDataUrl = order.qris_payload ? `${process.env.BASE_URL || ''}/qrs/${(await pool.query('SELECT qr_image_path FROM payments WHERE order_id=? LIMIT 1', [order.id]))[0][0].qr_image_path?.split('/').pop()}` : null;
  // simpler: get qr_image_path from payments:
  const [[payment]] = await pool.query('SELECT * FROM payments WHERE order_id=? LIMIT 1', [order.id]);
  const qrImg = payment?.qr_image_path || null;
  res.render('orders/show', { title: `Order #${order.id}`, order, items, qrImg });
});

export default router;
