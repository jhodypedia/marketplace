// server.js
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import methodOverride from 'method-override';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';

import authRoutes from './routes/auth.js';
import siteRoutes from './routes/site.js';
import adminRoutes from './routes/admin.js';
import ordersApiRoutes from './routes/orders.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'devsecret',
  resave: false,
  saveUninitialized: false,
  cookie: { sameSite: 'lax' }
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = { success: req.flash('success'), error: req.flash('error') };
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/layout');

app.use(authRoutes);
app.use(siteRoutes);
app.use(adminRoutes);
app.use(ordersApiRoutes);

app.get('/health', (_req,res)=> res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running: http://localhost:${port}`));
