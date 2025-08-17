// middleware/auth.js
export function ensureAuth(req, res, next) {
  if (req.session?.user) return next();
  req.flash('error', 'Silakan login terlebih dulu.');
  return res.redirect('/login');
}

export function ensureAdmin(req, res, next) {
  if (req.session?.user?.role === 'admin') return next();
  req.flash('error', 'Akses admin diperlukan.');
  return res.redirect('/login');
}
