// routes/orders.js  (for possible API usage)
import { Router } from 'express';
import { pool } from '../db.js';
import { ensureAuth } from '../middleware/auth.js';

const router = Router();

router.get('/api/my-orders', ensureAuth, async (req, res) => {
  const [orders] = await pool.query('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC', [req.session.user.id]);
  res.json({ ok: true, orders });
});

export default router;
