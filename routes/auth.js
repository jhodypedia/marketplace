// routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db.js';

const router = Router();

router.get('/login', (req, res) => {
  res.render('auth/login', { title: 'Masuk' });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE email=? AND status="active"', [email]);
  if (!rows.length) {
    req.flash('error', 'User tidak ditemukan / nonaktif.');
    return res.redirect('/login');
  }
  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    req.flash('error', 'Password salah.');
    return res.redirect('/login');
  }
  await pool.query('UPDATE users SET last_login=NOW() WHERE id=?', [user.id]);
  req.session.user = { id: user.id, name: user.name, role: user.role, email: user.email };
  res.redirect('/');
});

router.get('/register', (req, res) => {
  res.render('auth/register', { title: 'Daftar' });
});

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    await pool.query('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)', [name, email, hash, 'customer']);
    req.flash('success', 'Registrasi berhasil. Silakan login.');
    res.redirect('/login');
  } catch (e) {
    req.flash('error', 'Email sudah terpakai.');
    res.redirect('/register');
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

export default router;
