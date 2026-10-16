/**
 * Single API creation file — all commerce endpoints live here.
 * Entities: auth, users, dealers, products, product details, payments,
 * purchase confirmation, buy, sell, stock, stock add/out, returns, transfers.
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const {
  createAccessToken,
  authHandler,
  requireRole,
  requireSuperAdmin,
  findUserByEmail,
  findUserById,
  toPublicUser,
  verifyPassword,
} = require('./auth');
const {
  isSuperAdmin,
  canAssignRole,
  canManageCustomers,
  isAdminOrAbove,
} = require('./permissions');
const config = require('./config');
const { parsePrice, findDuplicateProduct, normalizeSku } = require('./pricing');
const {
  readCsv,
  appendCsvRow,
  updateCsvRows,
} = require('./csvStore');
const {
  findProduct,
  getStockSnapshot,
  applyStockChange,
  createOrder,
  asNumber: toNumber,
  shortId: invShortId,
  RETURN_HEADERS,
  TRANSFER_HEADERS,
} = require('./inventory');

const router = express.Router();

const HEADERS = {
  users: [
    'id',
    'email',
    'password',
    'password_hash',
    'first_name',
    'last_name',
    'role',
    'city',
    'created_at',
    'seed_run',
  ],
  dealers: ['id', 'name', 'code', 'region', 'status', 'contact_email', 'created_at', 'seed_run'],
  products: [
    'id',
    'dealer_id',
    'name',
    'sku',
    'category',
    'price',
    'currency',
    'stock',
    'status',
    'created_at',
    'seed_run',
  ],
  product_details: [
    'id',
    'product_id',
    'description',
    'warranty_months',
    'weight_kg',
    'color',
    'dimensions',
    'created_at',
    'seed_run',
  ],
  payments: [
    'id',
    'user_id',
    'amount',
    'currency',
    'method',
    'status',
    'reference',
    'created_at',
    'seed_run',
  ],
  purchases: [
    'id',
    'user_id',
    'product_id',
    'payment_id',
    'dealer_id',
    'quantity',
    'unit_price',
    'total_amount',
    'currency',
    'confirmation_code',
    'status',
    'confirmed_at',
    'seed_run',
  ],
  orders: [
    'id',
    'type',
    'user_id',
    'dealer_id',
    'product_id',
    'payment_id',
    'quantity',
    'unit_price',
    'total_amount',
    'currency',
    'status',
    'reference',
    'notes',
    'created_at',
    'seed_run',
  ],
  stock_movements: [
    'id',
    'product_id',
    'dealer_id',
    'type',
    'direction',
    'quantity',
    'stock_before',
    'stock_after',
    'reference_id',
    'reference_type',
    'reason',
    'performed_by',
    'created_at',
    'seed_run',
  ],
  returns: RETURN_HEADERS,
  transfers: TRANSFER_HEADERS,
};

function shortId(prefix) {
  return `${prefix}_${uuidv4().replace(/-/g, '').slice(0, 10)}`;
}

function badRequest(res, message) {
  return res.status(400).json({ error: 'Bad Request', message });
}

function notFound(res, message) {
  return res.status(404).json({ error: 'Not Found', message });
}

function asNumber(value, fallback = 0) {
  return toNumber(value, fallback);
}

function handleInventoryError(res, error) {
  return res.status(error.status || 500).json({
    error: error.status === 400 ? 'Bad Request' : error.status === 404 ? 'Not Found' : 'Internal Server Error',
    message: error.message,
  });
}

function deleteById(entity, headers, id) {
  const rows = readCsv(entity);
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) {
    return null;
  }
  const [removed] = rows.splice(index, 1);
  updateCsvRows(entity, headers, rows);
  return removed;
}

function updateById(entity, headers, id, patch) {
  const rows = readCsv(entity);
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) {
    return null;
  }
  rows[index] = { ...rows[index], ...patch, id: rows[index].id };
  updateCsvRows(entity, headers, rows);
  return rows[index];
}

function sendForbidden(res, message) {
  return res.status(403).json({ error: 'Forbidden', message });
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password, password_hash, ...publicFields } = user;
  return publicFields;
}

// ─── Auth token creator ─────────────────────────────────────────────────────

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return badRequest(res, 'email and password are required');
  }

  const user = findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid email or password',
    });
  }

  const access_token = createAccessToken(user);

  return res.status(200).json({
    access_token,
    token_type: 'Bearer',
    expires_in: 'see ACCESS_TOKEN_TTL in .env',
    user: toPublicUser(user),
  });
});

router.get('/auth/me', authHandler, (req, res) => {
  return res.status(200).json(req.user);
});

router.get('/meta/products', (_req, res) => {
  return res.status(200).json({
    price_min: config.product.priceMin,
    price_max: config.product.priceMax,
    price_step: 0.01,
    rules: {
      unique_sku: true,
      unique_dealer_name_category_price: true,
      price_type: 'float',
    },
  });
});

router.get('/auth/permissions', authHandler, (req, res) => {
  const { buildPermissionMap } = require('./permissions');
  return res.status(200).json({
    role: req.user.role,
    permissions: buildPermissionMap(req.user),
  });
});

// ─── Dashboard snapshot (any authenticated role — scoped in UI) ─────────────

router.get('/dashboard/snapshot', authHandler, (_req, res) => {
  const entities = {};
  let seedRun = null;

  for (const [name, columns] of Object.entries(HEADERS)) {
    let rows = readCsv(name);
    if (name === 'users') {
      rows = rows.map(sanitizeUser);
    }

    if (!seedRun) {
      const seededRow = rows.find((row) => row.seed_run && row.seed_run !== 'runtime');
      seedRun = seededRow?.seed_run || null;
    }

    const seeded = rows.filter((row) => String(row.seed_run || '') !== 'runtime');
    const created = rows.filter((row) => String(row.seed_run || '') === 'runtime');

    entities[name] = {
      columns: name === 'users'
        ? columns.filter((col) => col !== 'password' && col !== 'password_hash')
        : columns,
      seeded,
      created,
      totals: {
        all: rows.length,
        seeded: seeded.length,
        created: created.length,
      },
    };
  }

  return res.status(200).json({
    generated_at: new Date().toISOString(),
    seed_run: seedRun,
    entities,
  });
});

// ─── Users ──────────────────────────────────────────────────────────────────

router.get('/users', authHandler, requireRole('admin'), (_req, res) => {
  const users = readCsv('users').map(sanitizeUser);
  return res.status(200).json({ total: users.length, users });
});

router.get('/users/:id', authHandler, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) {
    return notFound(res, 'User not found');
  }

  if (!isAdminOrAbove(req.user) && req.user.id !== user.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only view your own user profile',
    });
  }

  return res.status(200).json(sanitizeUser(user));
});

router.post('/users', authHandler, requireRole('admin'), async (req, res) => {
  const {
    email,
    password = 'Password@123',
    first_name,
    last_name,
    role = 'customer',
    city = 'Dhaka',
  } = req.body || {};

  if (!email || !first_name || !last_name) {
    return badRequest(res, 'email, first_name, and last_name are required');
  }

  if (!['customer', 'dealer', 'admin', 'super_admin'].includes(role)) {
    return badRequest(res, 'role must be customer, dealer, admin, or super_admin');
  }

  if (!canAssignRole(req.user, role)) {
    return sendForbidden(
      res,
      isSuperAdmin(req.user)
        ? 'Invalid role assignment'
        : 'Admin can only create customer or dealer users'
    );
  }

  if (findUserByEmail(email)) {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Email already registered',
    });
  }

  const user = {
    id: shortId('usr'),
    email: String(email).toLowerCase(),
    password,
    password_hash: await bcrypt.hash(password, 10),
    first_name,
    last_name,
    role,
    city,
    created_at: new Date().toISOString(),
    seed_run: 'runtime',
  };

  appendCsvRow('users', HEADERS.users, user);
  return res.status(201).json({
    message: 'User created',
    user: sanitizeUser(user),
  });
});

router.put('/users/:id', authHandler, requireRole('admin'), async (req, res) => {
  const existing = findUserById(req.params.id);
  if (!existing) {
    return notFound(res, 'User not found');
  }

  if (existing.role === 'super_admin' && !isSuperAdmin(req.user)) {
    return sendForbidden(res, 'Only super admin can edit a super admin');
  }

  const {
    email,
    password,
    first_name,
    last_name,
    role,
    city,
  } = req.body || {};

  const patch = {};
  if (email != null) {
    const conflict = findUserByEmail(email);
    if (conflict && conflict.id !== existing.id) {
      return res.status(409).json({ error: 'Conflict', message: 'Email already registered' });
    }
    patch.email = String(email).toLowerCase();
  }
  if (first_name != null) patch.first_name = first_name;
  if (last_name != null) patch.last_name = last_name;
  if (city != null) patch.city = city;
  if (role != null) {
    if (!['customer', 'dealer', 'admin', 'super_admin'].includes(role)) {
      return badRequest(res, 'Invalid role');
    }
    if (!canAssignRole(req.user, role)) {
      return sendForbidden(
        res,
        isSuperAdmin(req.user)
          ? 'Invalid role assignment'
          : 'Admin can only assign customer or dealer roles'
      );
    }
    patch.role = role;
  }
  if (password) {
    patch.password = password;
    patch.password_hash = await bcrypt.hash(password, 10);
  }

  const updated = updateById('users', HEADERS.users, req.params.id, patch);
  return res.status(200).json({
    message: 'User updated',
    user: sanitizeUser(updated),
  });
});

router.delete('/users/:id', authHandler, requireSuperAdmin, (req, res) => {
  if (req.params.id === req.user.id) {
    return badRequest(res, 'Cannot delete the currently authenticated super admin');
  }

  const removed = deleteById('users', HEADERS.users, req.params.id);
  if (!removed) {
    return notFound(res, 'User not found');
  }

  return res.status(200).json({
    message: 'User deleted',
    user: sanitizeUser(removed),
  });
});

// ─── Dealers ────────────────────────────────────────────────────────────────

router.get('/dealers', authHandler, (_req, res) => {
  const dealers = readCsv('dealers');
  return res.status(200).json({ total: dealers.length, dealers });
});

router.get('/dealers/:id', authHandler, (req, res) => {
  const dealer = readCsv('dealers').find((row) => row.id === req.params.id);
  if (!dealer) {
    return notFound(res, 'Dealer not found');
  }
  return res.status(200).json(dealer);
});

router.post('/dealers', authHandler, requireRole('admin'), (req, res) => {
  const { name, code, region, contact_email, status = 'active' } = req.body || {};

  if (!name || !code || !region || !contact_email) {
    return badRequest(res, 'name, code, region, and contact_email are required');
  }

  const dealer = {
    id: shortId('dlr'),
    name,
    code,
    region,
    status,
    contact_email,
    created_at: new Date().toISOString(),
    seed_run: 'runtime',
  };

  appendCsvRow('dealers', HEADERS.dealers, dealer);
  return res.status(201).json(dealer);
});

router.put('/dealers/:id', authHandler, requireRole('admin'), (req, res) => {
  const existing = readCsv('dealers').find((row) => row.id === req.params.id);
  if (!existing) {
    return notFound(res, 'Dealer not found');
  }

  const { name, code, region, contact_email, status } = req.body || {};
  const patch = {};
  if (name != null) patch.name = name;
  if (code != null) patch.code = code;
  if (region != null) patch.region = region;
  if (contact_email != null) patch.contact_email = contact_email;
  if (status != null) patch.status = status;

  const updated = updateById('dealers', HEADERS.dealers, req.params.id, patch);
  return res.status(200).json({ message: 'Dealer updated', dealer: updated });
});

router.delete('/dealers/:id', authHandler, requireSuperAdmin, (req, res) => {
  const linkedProducts = readCsv('products').filter((row) => row.dealer_id === req.params.id);
  const force = String(req.query.force || req.body?.force || '').toLowerCase() === 'true';

  if (linkedProducts.length && !force) {
    // Super admin can bypass with ?force=true (cascade)
    return badRequest(
      res,
      `Dealer has ${linkedProducts.length} linked product(s). Re-send with ?force=true to cascade delete as super admin.`
    );
  }

  if (linkedProducts.length && force) {
    const productIds = new Set(linkedProducts.map((p) => p.id));
    updateCsvRows(
      'products',
      HEADERS.products,
      readCsv('products').filter((row) => row.dealer_id !== req.params.id)
    );
    updateCsvRows(
      'product_details',
      HEADERS.product_details,
      readCsv('product_details').filter((row) => !productIds.has(row.product_id))
    );
  }

  const removed = deleteById('dealers', HEADERS.dealers, req.params.id);
  if (!removed) {
    return notFound(res, 'Dealer not found');
  }

  return res.status(200).json({
    message: force && linkedProducts.length ? 'Dealer force-deleted with cascade' : 'Dealer deleted',
    dealer: removed,
    cascaded_products: force ? linkedProducts.length : 0,
  });
});

// ─── Products ───────────────────────────────────────────────────────────────

router.get('/products', authHandler, (req, res) => {
  let products = readCsv('products');
  const { dealer_id, category, status } = req.query;

  if (dealer_id) products = products.filter((row) => row.dealer_id === dealer_id);
  if (category) products = products.filter((row) => row.category === category);
  if (status) products = products.filter((row) => row.status === status);

  return res.status(200).json({ total: products.length, products });
});

router.get('/products/:id', authHandler, (req, res) => {
  const product = readCsv('products').find((row) => row.id === req.params.id);
  if (!product) {
    return notFound(res, 'Product not found');
  }
  return res.status(200).json(product);
});

router.post('/products', authHandler, requireRole('admin', 'dealer'), (req, res) => {
  const {
    dealer_id,
    name,
    sku,
    category,
    price,
    currency = 'USD',
    stock = 0,
    status = 'active',
  } = req.body || {};

  if (!dealer_id || !name || !sku || !category || price == null || price === '') {
    return badRequest(res, 'dealer_id, name, sku, category, and price are required');
  }

  const dealer = readCsv('dealers').find((row) => row.id === dealer_id);
  if (!dealer) {
    return badRequest(res, 'dealer_id does not exist');
  }

  let parsedPrice;
  try {
    parsedPrice = parsePrice(price, 'price');
  } catch (error) {
    return badRequest(res, error.message);
  }

  const normalizedSku = normalizeSku(sku);
  const duplicate = findDuplicateProduct({
    dealerId: dealer_id,
    name,
    sku: normalizedSku,
    category,
    price: parsedPrice,
  });

  if (duplicate) {
    return res.status(409).json({
      error: 'Conflict',
      message: duplicate.message,
      reason: duplicate.reason,
      existing: duplicate.existing,
    });
  }

  const product = {
    id: shortId('prd'),
    dealer_id,
    name: String(name).trim(),
    sku: normalizedSku,
    category: String(category).trim(),
    price: parsedPrice,
    currency,
    stock: asNumber(stock),
    status,
    created_at: new Date().toISOString(),
    seed_run: 'runtime',
  };

  appendCsvRow('products', HEADERS.products, product);
  return res.status(201).json(product);
});

router.put('/products/:id', authHandler, requireRole('admin', 'dealer'), (req, res) => {
  const existing = findProduct(req.params.id);
  if (!existing) {
    return notFound(res, 'Product not found');
  }

  const { dealer_id, name, sku, category, price, currency, stock, status } = req.body || {};
  const patch = {};

  if (dealer_id != null) {
    if (!readCsv('dealers').some((row) => row.id === dealer_id)) {
      return badRequest(res, 'dealer_id does not exist');
    }
    patch.dealer_id = dealer_id;
  }
  if (name != null) patch.name = String(name).trim();
  if (sku != null) patch.sku = normalizeSku(sku);
  if (category != null) patch.category = String(category).trim();
  if (currency != null) patch.currency = currency;
  if (stock != null) patch.stock = asNumber(stock);
  if (status != null) patch.status = status;

  if (price != null && price !== '') {
    try {
      patch.price = parsePrice(price, 'price');
    } catch (error) {
      return badRequest(res, error.message);
    }
  }

  const next = { ...existing, ...patch };
  const duplicate = findDuplicateProduct({
    dealerId: next.dealer_id,
    name: next.name,
    sku: next.sku,
    category: next.category,
    price: Number(next.price),
    excludeId: existing.id,
  });

  if (duplicate) {
    return res.status(409).json({
      error: 'Conflict',
      message: duplicate.message,
      reason: duplicate.reason,
      existing: duplicate.existing,
    });
  }

  const updated = updateById('products', HEADERS.products, req.params.id, patch);
  return res.status(200).json({ message: 'Product updated', product: updated });
});

/** Product current state — status + stock */
router.put('/products/:id/state', authHandler, requireRole('admin', 'dealer'), (req, res) => {
  const existing = findProduct(req.params.id);
  if (!existing) {
    return notFound(res, 'Product not found');
  }

  const { status, stock } = req.body || {};
  if (status == null && stock == null) {
    return badRequest(res, 'Provide status and/or stock');
  }

  const patch = {};
  if (status != null) {
    if (!['active', 'inactive', 'discontinued', 'out_of_stock'].includes(status)) {
      return badRequest(res, 'status must be active, inactive, discontinued, or out_of_stock');
    }
    patch.status = status;
  }
  if (stock != null) {
    const nextStock = asNumber(stock);
    if (nextStock < 0) {
      return badRequest(res, 'stock cannot be negative');
    }
    patch.stock = nextStock;
  }

  const updated = updateById('products', HEADERS.products, req.params.id, patch);
  return res.status(200).json({
    message: 'Product state updated',
    product: updated,
  });
});

router.delete('/products/:id', authHandler, requireRole('admin', 'dealer'), (req, res) => {
  const removed = deleteById('products', HEADERS.products, req.params.id);
  if (!removed) {
    return notFound(res, 'Product not found');
  }

  const details = readCsv('product_details').filter((row) => row.product_id !== req.params.id);
  updateCsvRows('product_details', HEADERS.product_details, details);

  return res.status(200).json({ message: 'Product deleted', product: removed });
});

// ─── Product details ────────────────────────────────────────────────────────

router.get('/product-details', authHandler, (req, res) => {
  let details = readCsv('product_details');
  if (req.query.product_id) {
    details = details.filter((row) => row.product_id === req.query.product_id);
  }
  return res.status(200).json({ total: details.length, product_details: details });
});

router.get('/product-details/:id', authHandler, (req, res) => {
  const detail = readCsv('product_details').find((row) => row.id === req.params.id);
  if (!detail) {
    return notFound(res, 'Product detail not found');
  }
  return res.status(200).json(detail);
});

router.get('/products/:id/details', authHandler, (req, res) => {
  const product = readCsv('products').find((row) => row.id === req.params.id);
  if (!product) {
    return notFound(res, 'Product not found');
  }

  const detail = readCsv('product_details').find((row) => row.product_id === product.id);
  return res.status(200).json({
    product,
    details: detail || null,
  });
});

router.post('/product-details', authHandler, requireRole('admin', 'dealer'), (req, res) => {
  const {
    product_id,
    description,
    warranty_months = 12,
    weight_kg = 0,
    color = 'n/a',
    dimensions = 'n/a',
  } = req.body || {};

  if (!product_id || !description) {
    return badRequest(res, 'product_id and description are required');
  }

  const product = readCsv('products').find((row) => row.id === product_id);
  if (!product) {
    return badRequest(res, 'product_id does not exist');
  }

  const existing = readCsv('product_details').find((row) => row.product_id === product_id);
  if (existing) {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Product details already exist for this product',
      existing,
    });
  }

  const detail = {
    id: shortId('pdt'),
    product_id,
    description,
    warranty_months: asNumber(warranty_months, 12),
    weight_kg: asNumber(weight_kg),
    color,
    dimensions,
    created_at: new Date().toISOString(),
    seed_run: 'runtime',
  };

  appendCsvRow('product_details', HEADERS.product_details, detail);
  return res.status(201).json(detail);
});

router.put('/product-details/:id', authHandler, requireRole('admin', 'dealer'), (req, res) => {
  const existing = readCsv('product_details').find((row) => row.id === req.params.id);
  if (!existing) {
    return notFound(res, 'Product detail not found');
  }

  const { description, warranty_months, weight_kg, color, dimensions } = req.body || {};
  const patch = {};
  if (description != null) patch.description = description;
  if (warranty_months != null) patch.warranty_months = asNumber(warranty_months, 12);
  if (weight_kg != null) patch.weight_kg = asNumber(weight_kg);
  if (color != null) patch.color = color;
  if (dimensions != null) patch.dimensions = dimensions;

  const updated = updateById('product_details', HEADERS.product_details, req.params.id, patch);
  return res.status(200).json({ message: 'Product details updated', product_detail: updated });
});

router.delete('/product-details/:id', authHandler, requireRole('admin', 'dealer'), (req, res) => {
  const removed = deleteById('product_details', HEADERS.product_details, req.params.id);
  if (!removed) {
    return notFound(res, 'Product detail not found');
  }
  return res.status(200).json({ message: 'Product details deleted', product_detail: removed });
});

// ─── Payments (per user) ────────────────────────────────────────────────────

router.get('/payments', authHandler, (req, res) => {
  let payments = readCsv('payments');

  if (!isAdminOrAbove(req.user)) {
    payments = payments.filter((row) => row.user_id === req.user.id);
  } else if (req.query.user_id) {
    payments = payments.filter((row) => row.user_id === req.query.user_id);
  }

  if (req.query.status) {
    payments = payments.filter((row) => row.status === req.query.status);
  }

  return res.status(200).json({ total: payments.length, payments });
});

router.get('/payments/:id', authHandler, (req, res) => {
  const payment = readCsv('payments').find((row) => row.id === req.params.id);
  if (!payment) {
    return notFound(res, 'Payment not found');
  }

  if (!isAdminOrAbove(req.user) && payment.user_id !== req.user.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only view your own payments',
    });
  }

  return res.status(200).json(payment);
});

router.get('/users/:id/payments', authHandler, (req, res) => {
  if (!isAdminOrAbove(req.user) && req.user.id !== req.params.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only list your own payments',
    });
  }

  const user = findUserById(req.params.id);
  if (!user) {
    return notFound(res, 'User not found');
  }

  const payments = readCsv('payments').filter((row) => row.user_id === req.params.id);
  return res.status(200).json({
    user_id: req.params.id,
    total: payments.length,
    payments,
  });
});

router.post('/payments', authHandler, (req, res) => {
  const {
    amount,
    currency = 'USD',
    method = 'card',
    status = 'pending',
    user_id,
  } = req.body || {};

  if (amount == null) {
    return badRequest(res, 'amount is required');
  }

  const targetUserId =
    (req.user.role === 'admin' || isSuperAdmin(req.user)) && user_id ? user_id : req.user.id;
  if (!findUserById(targetUserId)) {
    return badRequest(res, 'user_id does not exist');
  }

  const payment = {
    id: shortId('pay'),
    user_id: targetUserId,
    amount: asNumber(amount),
    currency,
    method,
    status,
    reference: `REF-RT-${uuidv4().slice(0, 8).toUpperCase()}`,
    created_at: new Date().toISOString(),
    seed_run: 'runtime',
  };

  appendCsvRow('payments', HEADERS.payments, payment);
  return res.status(201).json(payment);
});

router.put('/payments/:id', authHandler, requireRole('admin'), (req, res) => {
  const existing = readCsv('payments').find((row) => row.id === req.params.id);
  if (!existing) {
    return notFound(res, 'Payment not found');
  }

  const { amount, currency, method, status, user_id } = req.body || {};
  const patch = {};
  if (amount != null) patch.amount = asNumber(amount);
  if (currency != null) patch.currency = currency;
  if (method != null) patch.method = method;
  if (status != null) patch.status = status;
  if (user_id != null) {
    if (!findUserById(user_id)) {
      return badRequest(res, 'user_id does not exist');
    }
    patch.user_id = user_id;
  }

  const updated = updateById('payments', HEADERS.payments, req.params.id, patch);
  return res.status(200).json({ message: 'Payment updated', payment: updated });
});

router.delete('/payments/:id', authHandler, requireSuperAdmin, (req, res) => {
  const removed = deleteById('payments', HEADERS.payments, req.params.id);
  if (!removed) {
    return notFound(res, 'Payment not found');
  }
  return res.status(200).json({ message: 'Payment deleted', payment: removed });
});

// ─── Purchase confirmation ──────────────────────────────────────────────────

router.get('/purchases', authHandler, (req, res) => {
  let purchases = readCsv('purchases');

  if (!isAdminOrAbove(req.user)) {
    purchases = purchases.filter((row) => row.user_id === req.user.id);
  } else if (req.query.user_id) {
    purchases = purchases.filter((row) => row.user_id === req.query.user_id);
  }

  return res.status(200).json({ total: purchases.length, purchases });
});

router.get('/purchases/:id', authHandler, (req, res) => {
  const purchase = readCsv('purchases').find((row) => row.id === req.params.id);
  if (!purchase) {
    return notFound(res, 'Purchase not found');
  }

  if (!isAdminOrAbove(req.user) && purchase.user_id !== req.user.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only view your own purchases',
    });
  }

  return res.status(200).json(purchase);
});

router.post('/purchases/confirm', authHandler, (req, res) => {
  const { product_id, payment_id, quantity = 1 } = req.body || {};

  if (!product_id || !payment_id) {
    return badRequest(res, 'product_id and payment_id are required');
  }

  const product = readCsv('products').find((row) => row.id === product_id);
  if (!product) {
    return badRequest(res, 'product_id does not exist');
  }

  const payment = readCsv('payments').find((row) => row.id === payment_id);
  if (!payment) {
    return badRequest(res, 'payment_id does not exist');
  }

  if (!isAdminOrAbove(req.user) && payment.user_id !== req.user.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Payment does not belong to the authenticated user',
    });
  }

  if (!['authorized', 'captured', 'pending'].includes(payment.status)) {
    return badRequest(res, `Payment status '${payment.status}' cannot confirm a purchase`);
  }

  const qty = Math.max(1, asNumber(quantity, 1));
  const stock = asNumber(product.stock);
  if (stock < qty) {
    return badRequest(res, `Insufficient stock. Available: ${stock}`);
  }

  const unitPrice = asNumber(product.price);
  const purchase = {
    id: shortId('pur'),
    user_id: payment.user_id,
    product_id: product.id,
    payment_id: payment.id,
    dealer_id: product.dealer_id,
    quantity: qty,
    unit_price: unitPrice,
    total_amount: Number((unitPrice * qty).toFixed(2)),
    currency: product.currency || 'USD',
    confirmation_code: `CNF-RT-${uuidv4().slice(0, 8).toUpperCase()}`,
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
    seed_run: 'runtime',
  };

  appendCsvRow('purchases', HEADERS.purchases, purchase);

  let movement = null;
  try {
    ({ movement } = applyStockChange({
      productId: product.id,
      delta: -qty,
      type: 'buy',
      reason: 'purchase_confirm',
      performedBy: req.user.id,
      referenceId: purchase.id,
      referenceType: 'purchase',
    }));
  } catch (error) {
    return handleInventoryError(res, error);
  }

  const payments = readCsv('payments').map((row) => {
    if (row.id !== payment.id) return row;
    return { ...row, status: 'captured' };
  });
  updateCsvRows('payments', HEADERS.payments, payments);

  return res.status(201).json({
    message: 'Purchase confirmed',
    purchase,
    stock_movement: movement,
  });
});

// ─── Stock ──────────────────────────────────────────────────────────────────

router.get('/stock', authHandler, (req, res) => {
  let stock = getStockSnapshot();
  if (req.query.dealer_id) {
    stock = stock.filter((row) => row.dealer_id === req.query.dealer_id);
  }
  if (req.query.low_stock) {
    const threshold = asNumber(req.query.low_stock, 10);
    stock = stock.filter((row) => row.stock <= threshold);
  }
  return res.status(200).json({ total: stock.length, stock });
});

router.get('/stock/movements', authHandler, (req, res) => {
  let movements = readCsv('stock_movements');
  if (req.query.product_id) {
    movements = movements.filter((row) => row.product_id === req.query.product_id);
  }
  if (req.query.type) {
    movements = movements.filter((row) => row.type === req.query.type);
  }
  if (req.query.direction) {
    movements = movements.filter((row) => row.direction === req.query.direction);
  }
  return res.status(200).json({ total: movements.length, movements });
});

router.get('/stock/:productId', authHandler, (req, res) => {
  const product = findProduct(req.params.productId);
  if (!product) {
    return notFound(res, 'Product not found');
  }

  const movements = readCsv('stock_movements').filter(
    (row) => row.product_id === product.id
  );

  return res.status(200).json({
    product_id: product.id,
    sku: product.sku,
    name: product.name,
    dealer_id: product.dealer_id,
    stock: asNumber(product.stock),
    status: product.status,
    recent_movements: movements.slice(-10),
  });
});

router.post('/stock/add', authHandler, requireRole('admin', 'dealer'), (req, res) => {
  const { product_id, quantity, reason = 'stock_add' } = req.body || {};

  if (!product_id || quantity == null) {
    return badRequest(res, 'product_id and quantity are required');
  }

  const qty = asNumber(quantity);
  if (qty <= 0) {
    return badRequest(res, 'quantity must be a positive number');
  }

  try {
    const result = applyStockChange({
      productId: product_id,
      delta: qty,
      type: 'stock_add',
      reason,
      performedBy: req.user.id,
      referenceType: 'stock_add',
    });

    return res.status(201).json({
      message: 'Stock added',
      stock: asNumber(result.product.stock),
      movement: result.movement,
    });
  } catch (error) {
    return handleInventoryError(res, error);
  }
});

router.post('/stock/out', authHandler, requireRole('admin', 'dealer'), (req, res) => {
  const {
    product_id,
    quantity,
    reason = 'stock_out',
    unit_price,
    price,
  } = req.body || {};

  if (!product_id || quantity == null) {
    return badRequest(res, 'product_id and quantity are required');
  }

  const qty = asNumber(quantity);
  if (qty <= 0) {
    return badRequest(res, 'quantity must be a positive number');
  }

  let pricedAt = null;
  const rawPrice = unit_price != null && unit_price !== '' ? unit_price : price;
  if (rawPrice != null && rawPrice !== '') {
    try {
      pricedAt = parsePrice(rawPrice, unit_price != null && unit_price !== '' ? 'unit_price' : 'price');
    } catch (error) {
      return badRequest(res, error.message);
    }
  }

  try {
    const existing = findProduct(product_id);
    if (!existing) {
      return notFound(res, 'Product not found');
    }

    if (pricedAt != null) {
      updateById('products', HEADERS.products, product_id, { price: pricedAt });
    }

    const result = applyStockChange({
      productId: product_id,
      delta: -qty,
      type: 'stock_out',
      reason: pricedAt != null ? `${reason}|price=${pricedAt}` : reason,
      performedBy: req.user.id,
      referenceType: 'stock_out',
    });

    let order = null;
    if (pricedAt != null) {
      order = createOrder({
        type: 'sell',
        user_id: req.user.id,
        dealer_id: result.product.dealer_id,
        product_id,
        quantity: qty,
        unit_price: pricedAt,
        total_amount: Number((pricedAt * qty).toFixed(2)),
        currency: result.product.currency || 'USD',
        status: 'completed',
        notes: `Stock out with price set (${pricedAt})`,
      });

      const movements = readCsv('stock_movements').map((row) => {
        if (row.id !== result.movement.id) return row;
        return { ...row, reference_id: order.id, reference_type: 'order' };
      });
      updateCsvRows('stock_movements', HEADERS.stock_movements, movements);
      result.movement = movements.find((row) => row.id === result.movement.id);
    }

    return res.status(201).json({
      message: pricedAt != null ? 'Stock out completed with price set' : 'Stock deducted',
      stock: asNumber(result.product.stock),
      unit_price: pricedAt,
      product: result.product,
      movement: result.movement,
      order,
    });
  } catch (error) {
    return handleInventoryError(res, error);
  }
});

router.post('/stock/adjust', authHandler, requireRole('admin'), (req, res) => {
  const { product_id, new_quantity, reason = 'inventory_adjustment' } = req.body || {};

  if (!product_id || new_quantity == null) {
    return badRequest(res, 'product_id and new_quantity are required');
  }

  const product = findProduct(product_id);
  if (!product) {
    return notFound(res, 'Product not found');
  }

  const current = asNumber(product.stock);
  const target = asNumber(new_quantity);
  if (target < 0) {
    return badRequest(res, 'new_quantity cannot be negative');
  }

  try {
    const result = applyStockChange({
      productId: product_id,
      delta: target - current,
      type: 'adjustment',
      reason,
      performedBy: req.user.id,
      referenceType: 'adjustment',
    });

    return res.status(200).json({
      message: 'Stock adjusted',
      stock_before: current,
      stock_after: asNumber(result.product.stock),
      movement: result.movement,
    });
  } catch (error) {
    return handleInventoryError(res, error);
  }
});

// ─── Buy (customer ecommerce purchase) ──────────────────────────────────────

router.post('/buy', authHandler, (req, res) => {
  const {
    product_id,
    quantity = 1,
    method = 'card',
    notes = '',
  } = req.body || {};

  if (!product_id) {
    return badRequest(res, 'product_id is required');
  }

  const product = findProduct(product_id);
  if (!product) {
    return badRequest(res, 'product_id does not exist');
  }

  const qty = Math.max(1, asNumber(quantity, 1));
  const unitPrice = asNumber(product.price);
  const totalAmount = Number((unitPrice * qty).toFixed(2));

  const payment = {
    id: shortId('pay'),
    user_id: req.user.id,
    amount: totalAmount,
    currency: product.currency || 'USD',
    method,
    status: 'captured',
    reference: `REF-BUY-${uuidv4().slice(0, 8).toUpperCase()}`,
    created_at: new Date().toISOString(),
    seed_run: 'runtime',
  };

  let movement;
  let order;

  try {
    ({ movement } = applyStockChange({
      productId: product.id,
      delta: -qty,
      type: 'buy',
      reason: 'customer_buy',
      performedBy: req.user.id,
      referenceType: 'order',
    }));

    appendCsvRow('payments', HEADERS.payments, payment);

    order = createOrder({
      type: 'buy',
      user_id: req.user.id,
      dealer_id: product.dealer_id,
      product_id: product.id,
      payment_id: payment.id,
      quantity: qty,
      unit_price: unitPrice,
      total_amount: totalAmount,
      currency: product.currency || 'USD',
      status: 'completed',
      notes: notes || 'Customer buy',
    });

    // Link movement to order
    const movements = readCsv('stock_movements').map((row) => {
      if (row.id !== movement.id) return row;
      return { ...row, reference_id: order.id, reference_type: 'order' };
    });
    updateCsvRows('stock_movements', HEADERS.stock_movements, movements);
    movement = movements.find((row) => row.id === movement.id);
  } catch (error) {
    return handleInventoryError(res, error);
  }

  return res.status(201).json({
    message: 'Buy completed',
    order,
    payment,
    stock_movement: movement,
  });
});

// ─── Sell (dealer/admin outbound sale) ───────────────────────────────────────

router.post('/sell', authHandler, requireRole('admin', 'dealer'), (req, res) => {
  const {
    product_id,
    quantity = 1,
    unit_price,
    buyer_name = 'walk-in',
    notes = '',
  } = req.body || {};

  if (!product_id) {
    return badRequest(res, 'product_id is required');
  }

  const product = findProduct(product_id);
  if (!product) {
    return badRequest(res, 'product_id does not exist');
  }

  const qty = Math.max(1, asNumber(quantity, 1));
  let price;
  try {
    price =
      unit_price == null || unit_price === ''
        ? parsePrice(product.price, 'product.price')
        : parsePrice(unit_price, 'unit_price');
  } catch (error) {
    return badRequest(res, error.message);
  }
  const totalAmount = Number((price * qty).toFixed(2));

  let movement;
  let order;

  try {
    ({ movement } = applyStockChange({
      productId: product.id,
      delta: -qty,
      type: 'sell',
      reason: 'dealer_sell',
      performedBy: req.user.id,
      referenceType: 'order',
    }));

    order = createOrder({
      type: 'sell',
      user_id: req.user.id,
      dealer_id: product.dealer_id,
      product_id: product.id,
      quantity: qty,
      unit_price: price,
      total_amount: totalAmount,
      currency: product.currency || 'USD',
      status: 'completed',
      notes: notes || `Sold to ${buyer_name}`,
    });

    const movements = readCsv('stock_movements').map((row) => {
      if (row.id !== movement.id) return row;
      return { ...row, reference_id: order.id, reference_type: 'order' };
    });
    updateCsvRows('stock_movements', HEADERS.stock_movements, movements);
    movement = movements.find((row) => row.id === movement.id);
  } catch (error) {
    return handleInventoryError(res, error);
  }

  return res.status(201).json({
    message: 'Sell completed',
    order,
    stock_movement: movement,
  });
});

// ─── Orders ─────────────────────────────────────────────────────────────────

router.get('/orders', authHandler, (req, res) => {
  let orders = readCsv('orders');

  if (req.user.role === 'customer') {
    orders = orders.filter((row) => row.user_id === req.user.id);
  } else if (req.query.user_id) {
    orders = orders.filter((row) => row.user_id === req.query.user_id);
  }

  if (req.query.type) {
    orders = orders.filter((row) => row.type === req.query.type);
  }
  if (req.query.status) {
    orders = orders.filter((row) => row.status === req.query.status);
  }

  return res.status(200).json({ total: orders.length, orders });
});

router.get('/orders/:id', authHandler, (req, res) => {
  const order = readCsv('orders').find((row) => row.id === req.params.id);
  if (!order) {
    return notFound(res, 'Order not found');
  }

  if (req.user.role === 'customer' && order.user_id !== req.user.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only view your own orders',
    });
  }

  return res.status(200).json(order);
});

router.put('/orders/:id', authHandler, requireRole('admin'), (req, res) => {
  const existing = readCsv('orders').find((row) => row.id === req.params.id);
  if (!existing) {
    return notFound(res, 'Order not found');
  }

  const { status, notes, quantity, unit_price, total_amount } = req.body || {};
  const patch = {};
  if (status != null) patch.status = status;
  if (notes != null) patch.notes = notes;
  if (quantity != null) patch.quantity = asNumber(quantity);
  if (unit_price != null) patch.unit_price = asNumber(unit_price);
  if (total_amount != null) patch.total_amount = asNumber(total_amount);

  const updated = updateById('orders', HEADERS.orders, req.params.id, patch);
  return res.status(200).json({ message: 'Order updated', order: updated });
});

router.delete('/orders/:id', authHandler, requireSuperAdmin, (req, res) => {
  const removed = deleteById('orders', HEADERS.orders, req.params.id);
  if (!removed) {
    return notFound(res, 'Order not found');
  }
  return res.status(200).json({ message: 'Order deleted', order: removed });
});

// ─── Returns ────────────────────────────────────────────────────────────────

router.get('/returns', authHandler, (req, res) => {
  let returns = readCsv('returns');

  if (req.user.role === 'customer') {
    returns = returns.filter((row) => row.user_id === req.user.id);
  } else if (req.query.user_id) {
    returns = returns.filter((row) => row.user_id === req.query.user_id);
  }

  return res.status(200).json({ total: returns.length, returns });
});

router.post('/returns', authHandler, (req, res) => {
  const { order_id, quantity, reason = 'customer_change_mind' } = req.body || {};

  if (!order_id) {
    return badRequest(res, 'order_id is required');
  }

  const order = readCsv('orders').find((row) => row.id === order_id);
  if (!order) {
    return badRequest(res, 'order_id does not exist');
  }

  if (req.user.role === 'customer' && order.user_id !== req.user.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only return your own orders',
    });
  }

  if (order.type !== 'buy' && order.type !== 'sell') {
    return badRequest(res, 'Only buy/sell orders can be returned');
  }

  const qty = Math.max(1, asNumber(quantity, asNumber(order.quantity, 1)));
  if (qty > asNumber(order.quantity)) {
    return badRequest(res, `Return quantity cannot exceed order quantity (${order.quantity})`);
  }

  const refundAmount = Number((asNumber(order.unit_price) * qty).toFixed(2));
  const returnRow = {
    id: invShortId('ret'),
    order_id: order.id,
    user_id: order.user_id || req.user.id,
    product_id: order.product_id,
    quantity: qty,
    refund_amount: refundAmount,
    currency: order.currency || 'USD',
    reason,
    status: 'approved',
    created_at: new Date().toISOString(),
    seed_run: 'runtime',
  };

  let movement;
  try {
    ({ movement } = applyStockChange({
      productId: order.product_id,
      delta: qty,
      type: 'return',
      reason: `return:${reason}`,
      performedBy: req.user.id,
      referenceId: returnRow.id,
      referenceType: 'return',
    }));
  } catch (error) {
    return handleInventoryError(res, error);
  }

  appendCsvRow('returns', HEADERS.returns, returnRow);

  return res.status(201).json({
    message: 'Return processed and stock restored',
    return: returnRow,
    stock_movement: movement,
  });
});

// ─── Transfers (dealer-to-dealer) ───────────────────────────────────────────

router.get('/transfers', authHandler, requireRole('admin', 'dealer'), (_req, res) => {
  const transfers = readCsv('transfers');
  return res.status(200).json({ total: transfers.length, transfers });
});

router.post('/transfers', authHandler, requireRole('admin', 'dealer'), (req, res) => {
  const {
    product_id,
    to_dealer_id,
    quantity = 1,
    notes = '',
  } = req.body || {};

  if (!product_id || !to_dealer_id) {
    return badRequest(res, 'product_id and to_dealer_id are required');
  }

  const product = findProduct(product_id);
  if (!product) {
    return badRequest(res, 'product_id does not exist');
  }

  const toDealer = readCsv('dealers').find((row) => row.id === to_dealer_id);
  if (!toDealer) {
    return badRequest(res, 'to_dealer_id does not exist');
  }

  if (product.dealer_id === to_dealer_id) {
    return badRequest(res, 'Cannot transfer to the same dealer');
  }

  const qty = Math.max(1, asNumber(quantity, 1));

  let outMovement;
  try {
    ({ movement: outMovement } = applyStockChange({
      productId: product.id,
      delta: -qty,
      type: 'transfer_out',
      reason: `transfer_to:${to_dealer_id}`,
      performedBy: req.user.id,
      referenceType: 'transfer',
    }));
  } catch (error) {
    return handleInventoryError(res, error);
  }

  // Create a mirrored product under destination dealer if needed, else bump matching SKU
  let destinationProduct = readCsv('products').find(
    (row) => row.dealer_id === to_dealer_id && row.sku === product.sku
  );

  if (!destinationProduct) {
    destinationProduct = {
      ...product,
      id: shortId('prd'),
      dealer_id: to_dealer_id,
      stock: '0',
      created_at: new Date().toISOString(),
      seed_run: 'runtime',
    };
    appendCsvRow('products', HEADERS.products, destinationProduct);
  }

  let inMovement;
  try {
    ({ movement: inMovement } = applyStockChange({
      productId: destinationProduct.id,
      delta: qty,
      type: 'transfer_in',
      reason: `transfer_from:${product.dealer_id}`,
      performedBy: req.user.id,
      referenceType: 'transfer',
    }));
  } catch (error) {
    return handleInventoryError(res, error);
  }

  const transfer = {
    id: invShortId('trn'),
    product_id: product.id,
    from_dealer_id: product.dealer_id,
    to_dealer_id,
    quantity: qty,
    status: 'completed',
    notes: notes || 'Dealer stock transfer',
    created_by: req.user.id,
    created_at: new Date().toISOString(),
    seed_run: 'runtime',
  };

  appendCsvRow('transfers', HEADERS.transfers, transfer);

  const movements = readCsv('stock_movements').map((row) => {
    if (row.id === outMovement.id || row.id === inMovement.id) {
      return { ...row, reference_id: transfer.id, reference_type: 'transfer' };
    }
    return row;
  });
  updateCsvRows('stock_movements', HEADERS.stock_movements, movements);

  return res.status(201).json({
    message: 'Transfer completed',
    transfer,
    source_movement: movements.find((row) => row.id === outMovement.id),
    destination_movement: movements.find((row) => row.id === inMovement.id),
    destination_product_id: destinationProduct.id,
  });
});

module.exports = router;
