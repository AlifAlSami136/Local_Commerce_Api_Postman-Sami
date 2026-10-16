require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const config = require('./config');
const { CSV_DIR, SEED_DIR, readCsv, readSeedJson } = require('./csvStore');
const apis = require('./apis');

const app = express();
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DASHBOARD_DIR = path.join(PUBLIC_DIR, 'dashboard');

app.use(cors());
app.use(express.json());

app.get(['/dashboard', '/dashboard/'], (_req, res) => {
  res.sendFile(path.join(DASHBOARD_DIR, 'index.html'));
});

app.use('/dashboard', express.static(DASHBOARD_DIR, { index: false }));

app.get('/', (_req, res) => {
  res.json({
    name: 'Local Commerce API',
    version: '1.1.0',
    base_url: config.baseUrl,
    dashboard: `${config.baseUrl}/dashboard`,
    storage: {
      csv_db: CSV_DIR,
      json_seeds: SEED_DIR,
      note: 'CSV is regenerated with new values on every npm start (prestart seed)',
    },
    auth: {
      login: 'POST /api/auth/login',
      me: 'GET /api/auth/me',
      header: 'Authorization: Bearer <access_token>',
    },
    endpoints: {
      dashboard_snapshot: 'GET /api/dashboard/snapshot (admin)',
      users: 'GET /api/users',
      dealers: 'GET|POST /api/dealers',
      products: 'GET|POST /api/products',
      product_details: 'GET|POST /api/product-details',
      payments: 'GET|POST /api/payments',
      user_payments: 'GET /api/users/:id/payments',
      purchases: 'GET /api/purchases',
      purchase_confirm: 'POST /api/purchases/confirm',
      stock: 'GET /api/stock',
      stock_add: 'POST /api/stock/add',
      stock_out: 'POST /api/stock/out',
      stock_adjust: 'POST /api/stock/adjust',
      stock_movements: 'GET /api/stock/movements',
      buy: 'POST /api/buy',
      sell: 'POST /api/sell',
      orders: 'GET /api/orders',
      returns: 'GET|POST /api/returns',
      transfers: 'GET|POST /api/transfers',
    },
  });
});

app.get('/health', (_req, res) => {
  const entities = [
    'users',
    'dealers',
    'products',
    'product_details',
    'payments',
    'purchases',
    'orders',
    'stock_movements',
    'returns',
    'transfers',
  ];
  const counts = {};

  for (const entity of entities) {
    counts[entity] = readCsv(entity).length;
  }

  const seedRun = readCsv('users')[0]?.seed_run || null;

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    base_url: config.baseUrl,
    seed_run: seedRun,
    dashboard: `${config.baseUrl}/dashboard`,
    counts,
  });
});

app.get('/meta/seed', (_req, res) => {
  res.json({
    csv_exists: fs.existsSync(CSV_DIR),
    seeds: {
      users: readSeedJson('users').length,
      dealers: readSeedJson('dealers').length,
      products: readSeedJson('products').length,
      product_details: readSeedJson('product_details').length,
      payments: readSeedJson('payments').length,
      purchases: readSeedJson('purchases').length,
      orders: readSeedJson('orders').length,
      stock_movements: readSeedJson('stock_movements').length,
      returns: readSeedJson('returns').length,
      transfers: readSeedJson('transfers').length,
    },
  });
});

app.use('/api', apis);

app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Route not found',
  });
});

app.listen(config.port, () => {
  console.log(`Local Commerce API running at ${config.baseUrl}`);
  console.log(`Dashboard: ${config.baseUrl}/dashboard`);
  console.log('CSV DB:', CSV_DIR);
  console.log('JSON seeds:', SEED_DIR);
  console.log('Login: POST /api/auth/login');
  console.log('Demo: superadmin@commerce.local / Super@123 (super_admin)');
  console.log('Demo: admin@commerce.local / Admin@123 (admin)');
  console.log('Demo: customer@commerce.local / Password@123 (customer)');
  console.log('Demo: dealer@commerce.local / Password@123 (dealer)');
});
