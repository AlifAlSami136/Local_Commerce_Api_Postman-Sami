require('dotenv').config();

function floatEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

const priceMin = floatEnv('PRODUCT_PRICE_MIN', 1);
const priceMax = floatEnv('PRODUCT_PRICE_MAX', 100);

module.exports = {
  port: intEnv('PORT', 3002),
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3002}`,
  jwtSecret: process.env.JWT_SECRET || 'commerce-local-dev-secret',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '1h',
  seed: {
    users: intEnv('SEED_USERS', 8),
    dealers: intEnv('SEED_DEALERS', 5),
    products: intEnv('SEED_PRODUCTS', 12),
    payments: intEnv('SEED_PAYMENTS', 10),
    purchases: intEnv('SEED_PURCHASES', 6),
    orders: intEnv('SEED_ORDERS', 8),
    stockMovements: intEnv('SEED_STOCK_MOVEMENTS', 16),
    returns: intEnv('SEED_RETURNS', 3),
    transfers: intEnv('SEED_TRANSFERS', 3),
  },
  product: {
    priceMin,
    priceMax,
  },
};
