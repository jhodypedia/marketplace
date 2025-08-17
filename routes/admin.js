// routes/admin.js
import { Router } from 'express';
import slugify from 'slugify';
import { pool } from '../db.js';
import { ensureAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/admin', ensureAdmin, async (req, res) => {
  const [[{c: itemCount}]] = await pool.query('SELECT COUNT(*) as c FROM items');
  const [[{o: orderCount}]] = await pool.query('SELECT COUNT(*) as o FROM orders');
  res.render('admin/dashboard', { title: 'Admin Dashboard', itemCount, orderCount });
});

/* API for stats (JSON) */
router.get('/admin/api/stats', ensureAdmin, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') as ym,
           IFNULL(SUM(grand_total),0) as gross,
           IFNULL(SUM(fee_amount),0) as fee
    FROM orders
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY ym
    ORDER BY ym ASC
  `);
  const data = rows.map(r => ({ ym: r.ym, gross: Number(r.gross||0), fee: Number(r.fee||0), net: Number((r.gross||0) - (r.fee||0)) }));
  res.json({ ok: true, data });
});

/* Categories */
router.get('/admin/categories', ensureAdmin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM categories ORDER BY name');
  res.render('admin/categories/index', { title: 'Kategori', categories: rows });
});

router.post('/admin/categories', ensureAdmin, async (req, res) => {
  const { name, description } = req.body;
  const slug = slugify(name, { lower: true, strict: true });
  try {
    await pool.query('INSERT INTO categories (name,slug,description) VALUES (?,?,?)', [name, slug, description || null]);
    req.flash('success','Kategori dibuat.');
  } catch {
    req.flash('error','Slug sudah ada / gagal.');
  }
  res.redirect('/admin/categories');
});

router.post('/admin/categories/:id/delete', ensureAdmin, async (req, res) => {
  await pool.query('DELETE FROM categories WHERE id=?', [req.params.id]);
  req.flash('success','Kategori dihapus.');
  res.redirect('/admin/categories');
});

/* Items */
router.get('/admin/items', ensureAdmin, async (req, res) => {
  const [items] = await pool.query('SELECT i.*, c.name category_name FROM items i LEFT JOIN categories c ON i.category_id=c.id ORDER BY i.created_at DESC');
  const [categories] = await pool.query('SELECT * FROM categories ORDER BY name');
  res.render('admin/items/index', { title: 'Items', items, categories });
});

router.post('/admin/items', ensureAdmin, async (req, res) => {
  const { category_id, title, type, price, stock, image_url, description, published } = req.body;
  const slug = slugify(title, { lower: true, strict: true });
  try {
    await pool.query(
      'INSERT INTO items (category_id,title,slug,type,price,stock,image_url,description,published) VALUES (?,?,?,?,?,?,?,?,?)',
      [category_id || null, title, slug, type, price || 0, stock || 0, image_url || null, description || null, published ? 1 : 0]
    );
    req.flash('success','Item dibuat.');
  } catch {
    req.flash('error','Gagal membuat item (slug unik?).');
  }
  res.redirect('/admin/items');
});

router.post('/admin/items/:id/delete', ensureAdmin, async (req, res) => {
  await pool.query('DELETE FROM items WHERE id=?', [req.params.id]);
  req.flash('success','Item dihapus.');
  res.redirect('/admin/items');
});

/* Orders - admin */
router.get('/admin/orders', ensureAdmin, async (req, res) => {
  const [orders] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  res.render('admin/orders/index', { title: 'Orders', orders });
});

router.post('/admin/orders/:id/status', ensureAdmin, async (req, res) => {
  const { status } = req.body;
  await pool.query('UPDATE orders SET status=? WHERE id=?', [status, req.params.id]);
  req.flash('success','Status order diperbarui.');
  res.redirect('/admin/orders');
});

export default router;
