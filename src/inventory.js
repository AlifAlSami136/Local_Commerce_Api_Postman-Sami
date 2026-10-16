const { v4: uuidv4 } = require('uuid');
const { readCsv, appendCsvRow, updateCsvRows } = require('./csvStore');

const PRODUCT_HEADERS = [
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
];

const MOVEMENT_HEADERS = [
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
];

const ORDER_HEADERS = [
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
];

const RETURN_HEADERS = [
  'id',
  'order_id',
  'user_id',
  'product_id',
  'quantity',
  'refund_amount',
  'currency',
  'reason',
  'status',
  'created_at',
  'seed_run',
];

const TRANSFER_HEADERS = [
  'id',
  'product_id',
  'from_dealer_id',
  'to_dealer_id',
  'quantity',
  'status',
  'notes',
  'created_by',
  'created_at',
  'seed_run',
];

function shortId(prefix) {
  return `${prefix}_${uuidv4().replace(/-/g, '').slice(0, 10)}`;
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function findProduct(productId) {
  return readCsv('products').find((row) => row.id === productId) || null;
}

function getStockSnapshot() {
  return readCsv('products').map((product) => ({
    product_id: product.id,
    sku: product.sku,
    name: product.name,
    dealer_id: product.dealer_id,
    stock: asNumber(product.stock),
    status: product.status,
    currency: product.currency,
    price: asNumber(product.price),
  }));
}

/**
 * Apply a stock delta and write a movement ledger row.
 * delta > 0 increases stock; delta < 0 decreases stock.
 */
function applyStockChange({
  productId,
  delta,
  type,
  reason,
  performedBy,
  referenceId = '',
  referenceType = '',
  seedRun = 'runtime',
}) {
  const products = readCsv('products');
  const index = products.findIndex((row) => row.id === productId);

  if (index === -1) {
    const error = new Error('Product not found');
    error.status = 404;
    throw error;
  }

  const product = products[index];
  const stockBefore = asNumber(product.stock);
  const stockAfter = stockBefore + delta;

  if (stockAfter < 0) {
    const error = new Error(`Insufficient stock. Available: ${stockBefore}, requested: ${Math.abs(delta)}`);
    error.status = 400;
    throw error;
  }

  products[index] = { ...product, stock: String(stockAfter) };
  updateCsvRows('products', PRODUCT_HEADERS, products);

  const movement = {
    id: shortId('mov'),
    product_id: product.id,
    dealer_id: product.dealer_id,
    type,
    direction: delta >= 0 ? 'in' : 'out',
    quantity: Math.abs(delta),
    stock_before: stockBefore,
    stock_after: stockAfter,
    reference_id: referenceId,
    reference_type: referenceType,
    reason: reason || type,
    performed_by: performedBy,
    created_at: new Date().toISOString(),
    seed_run: seedRun,
  };

  appendCsvRow('stock_movements', MOVEMENT_HEADERS, movement);

  return {
    product: products[index],
    movement,
    stock_before: stockBefore,
    stock_after: stockAfter,
  };
}

function createOrder(order) {
  const row = {
    id: order.id || shortId('ord'),
    type: order.type,
    user_id: order.user_id || '',
    dealer_id: order.dealer_id || '',
    product_id: order.product_id,
    payment_id: order.payment_id || '',
    quantity: order.quantity,
    unit_price: order.unit_price,
    total_amount: order.total_amount,
    currency: order.currency || 'USD',
    status: order.status || 'completed',
    reference: order.reference || `ORD-${uuidv4().slice(0, 8).toUpperCase()}`,
    notes: order.notes || '',
    created_at: order.created_at || new Date().toISOString(),
    seed_run: order.seed_run || 'runtime',
  };

  appendCsvRow('orders', ORDER_HEADERS, row);
  return row;
}

module.exports = {
  PRODUCT_HEADERS,
  MOVEMENT_HEADERS,
  ORDER_HEADERS,
  RETURN_HEADERS,
  TRANSFER_HEADERS,
  shortId,
  asNumber,
  findProduct,
  getStockSnapshot,
  applyStockChange,
  createOrder,
};
