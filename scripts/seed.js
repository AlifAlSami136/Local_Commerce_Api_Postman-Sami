require('dotenv').config();

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const config = require('../src/config');
const {
  ensureDirs,
  writeCsv,
  writeSeedJson,
  CSV_DIR,
  SEED_DIR,
} = require('../src/csvStore');

const FIRST_NAMES = ['Ava', 'Noah', 'Mia', 'Liam', 'Zoe', 'Omar', 'Nina', 'Eli', 'Sara', 'Kai'];
const LAST_NAMES = ['Patel', 'Nguyen', 'Khan', 'Rivera', 'Chen', 'Brooks', 'Silva', 'Ali', 'Park', 'Diaz'];
const CITIES = ['Dhaka', 'Austin', 'Toronto', 'Berlin', 'Singapore', 'Dubai', 'Lisbon', 'Seoul'];
const DEALER_NAMES = [
  'Northwind Traders',
  'Summit Supply Co',
  'Harbor Goods',
  'Atlas Retail Hub',
  'Prime Dealer Group',
  'Cascade Commerce',
  'Vertex Distributors',
];
const PRODUCT_NAMES = [
  'Wireless Mouse',
  'USB-C Hub',
  'Mechanical Keyboard',
  'Noise Cancelling Headphones',
  'Portable SSD',
  'Webcam Pro',
  'Smart Lamp',
  'Laptop Stand',
  'Power Bank',
  'Bluetooth Speaker',
  'Fitness Tracker',
  'Desk Mat',
];
const CATEGORIES = ['electronics', 'accessories', 'home', 'office', 'wearables'];
const PAYMENT_METHODS = ['card', 'bank_transfer', 'wallet', 'upi'];
const PAYMENT_STATUSES = ['pending', 'authorized', 'captured', 'failed'];
const PURCHASE_STATUSES = ['confirmed', 'processing', 'shipped', 'cancelled'];
const ORDER_TYPES = ['buy', 'sell'];
const ORDER_STATUSES = ['completed', 'processing', 'cancelled'];
const MOVEMENT_TYPES = ['stock_add', 'stock_out', 'buy', 'sell', 'return', 'transfer_in', 'transfer_out', 'adjustment'];
const RETURN_REASONS = ['damaged', 'wrong_item', 'customer_change_mind', 'defective'];
const RETURN_STATUSES = ['requested', 'approved', 'refunded', 'rejected'];
const TRANSFER_STATUSES = ['completed', 'pending', 'cancelled'];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function money(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function productPrice() {
  return money(config.product.priceMin, config.product.priceMax);
}

function shortId(prefix) {
  return `${prefix}_${uuidv4().replace(/-/g, '').slice(0, 10)}`;
}

function runId() {
  return uuidv4().slice(0, 8);
}

async function buildDataset() {
  const stamp = new Date().toISOString();
  const run = runId();

  const users = [];
  for (let i = 0; i < config.seed.users; i += 1) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const role = i === 0 ? 'admin' : i % 3 === 0 ? 'dealer' : 'customer';
    const plainPassword = role === 'admin' ? 'Admin@123' : 'Password@123';

    users.push({
      id: shortId('usr'),
      email: `${first.toLowerCase()}.${last.toLowerCase()}.${run}${i}@example.com`,
      password: plainPassword,
      password_hash: await bcrypt.hash(plainPassword, 10),
      first_name: first,
      last_name: last,
      role,
      city: pick(CITIES),
      created_at: stamp,
      seed_run: run,
    });
  }

  // Keep predictable demo logins across regenerations
  users[0] = {
    ...users[0],
    email: 'superadmin@commerce.local',
    password: 'Super@123',
    password_hash: await bcrypt.hash('Super@123', 10),
    first_name: 'Super',
    last_name: 'Admin',
    role: 'super_admin',
  };
  if (users[1]) {
    users[1] = {
      ...users[1],
      email: 'admin@commerce.local',
      password: 'Admin@123',
      password_hash: await bcrypt.hash('Admin@123', 10),
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
    };
  }
  if (users[2]) {
    users[2] = {
      ...users[2],
      email: 'customer@commerce.local',
      password: 'Password@123',
      password_hash: await bcrypt.hash('Password@123', 10),
      first_name: 'Customer',
      last_name: 'Demo',
      role: 'customer',
    };
  }
  if (users[3]) {
    users[3] = {
      ...users[3],
      email: 'dealer@commerce.local',
      password: 'Password@123',
      password_hash: await bcrypt.hash('Password@123', 10),
      first_name: 'Dealer',
      last_name: 'Demo',
      role: 'dealer',
    };
  }

  const dealers = [];
  for (let i = 0; i < config.seed.dealers; i += 1) {
    dealers.push({
      id: shortId('dlr'),
      name: `${pick(DEALER_NAMES)} ${run.slice(0, 4).toUpperCase()}-${i + 1}`,
      code: `DLR-${run.toUpperCase()}-${String(i + 1).padStart(2, '0')}`,
      region: pick(CITIES),
      status: i % 5 === 0 ? 'inactive' : 'active',
      contact_email: `dealer${i + 1}.${run}@example.com`,
      created_at: stamp,
      seed_run: run,
    });
  }

  const products = [];
  const productDetails = [];
  for (let i = 0; i < config.seed.products; i += 1) {
    const productId = shortId('prd');
    const dealer = pick(dealers);
    const name = `${pick(PRODUCT_NAMES)} ${run.slice(0, 3).toUpperCase()}${i + 1}`;
    const price = productPrice();

    products.push({
      id: productId,
      dealer_id: dealer.id,
      name,
      sku: `SKU-${run.toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
      category: pick(CATEGORIES),
      price,
      currency: 'USD',
      stock: Math.floor(Math.random() * 200) + 1,
      status: 'active',
      created_at: stamp,
      seed_run: run,
    });

    productDetails.push({
      id: shortId('pdt'),
      product_id: productId,
      description: `${name} seeded for local API testing (run ${run}).`,
      warranty_months: pick([6, 12, 24, 36]),
      weight_kg: money(0.1, 5),
      color: pick(['black', 'white', 'blue', 'silver', 'red']),
      dimensions: `${pick([10, 15, 20, 25])}x${pick([8, 12, 18])}x${pick([2, 4, 6])} cm`,
      created_at: stamp,
      seed_run: run,
    });
  }

  const customers = users.filter((user) => user.role === 'customer');
  const payments = [];
  for (let i = 0; i < config.seed.payments; i += 1) {
    const user = pick(customers.length ? customers : users);
    payments.push({
      id: shortId('pay'),
      user_id: user.id,
      amount: money(15, 900),
      currency: 'USD',
      method: pick(PAYMENT_METHODS),
      status: pick(PAYMENT_STATUSES),
      reference: `REF-${run.toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
      created_at: stamp,
      seed_run: run,
    });
  }

  const purchases = [];
  for (let i = 0; i < config.seed.purchases; i += 1) {
    const user = pick(customers.length ? customers : users);
    const product = pick(products);
    const payment = payments[i % payments.length];
    const qty = Math.floor(Math.random() * 3) + 1;

    purchases.push({
      id: shortId('pur'),
      user_id: user.id,
      product_id: product.id,
      payment_id: payment.id,
      dealer_id: product.dealer_id,
      quantity: qty,
      unit_price: product.price,
      total_amount: Number((product.price * qty).toFixed(2)),
      currency: 'USD',
      confirmation_code: `CNF-${run.toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
      status: pick(PURCHASE_STATUSES),
      confirmed_at: stamp,
      seed_run: run,
    });
  }

  const orders = [];
  for (let i = 0; i < config.seed.orders; i += 1) {
    const product = pick(products);
    const type = pick(ORDER_TYPES);
    const user = pick(customers.length ? customers : users);
    const qty = Math.floor(Math.random() * 4) + 1;
    const unitPrice = product.price;
    const payment = payments[i % payments.length];

    orders.push({
      id: shortId('ord'),
      type,
      user_id: type === 'buy' ? user.id : '',
      dealer_id: product.dealer_id,
      product_id: product.id,
      payment_id: type === 'buy' ? payment.id : '',
      quantity: qty,
      unit_price: unitPrice,
      total_amount: Number((unitPrice * qty).toFixed(2)),
      currency: 'USD',
      status: pick(ORDER_STATUSES),
      reference: `ORD-${run.toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
      notes: `${type} order seeded for run ${run}`,
      created_at: stamp,
      seed_run: run,
    });
  }

  const stock_movements = [];
  for (let i = 0; i < config.seed.stockMovements; i += 1) {
    const product = pick(products);
    const type = pick(MOVEMENT_TYPES);
    const qty = Math.floor(Math.random() * 10) + 1;
    const direction = ['stock_add', 'return', 'transfer_in', 'adjustment'].includes(type) && i % 2 === 0
      ? 'in'
      : type === 'stock_add' || type === 'return' || type === 'transfer_in'
        ? 'in'
        : 'out';
    const stockBefore = Number(product.stock);
    const stockAfter = direction === 'in' ? stockBefore + qty : Math.max(0, stockBefore - qty);

    stock_movements.push({
      id: shortId('mov'),
      product_id: product.id,
      dealer_id: product.dealer_id,
      type,
      direction,
      quantity: qty,
      stock_before: stockBefore,
      stock_after: stockAfter,
      reference_id: orders[i % orders.length]?.id || '',
      reference_type: 'order',
      reason: `${type} seed movement`,
      performed_by: users[0].id,
      created_at: stamp,
      seed_run: run,
    });
  }

  const returns = [];
  for (let i = 0; i < config.seed.returns; i += 1) {
    const order = pick(orders.filter((o) => o.type === 'buy').concat(orders));
    const qty = Math.min(Number(order.quantity), Math.floor(Math.random() * 2) + 1);

    returns.push({
      id: shortId('ret'),
      order_id: order.id,
      user_id: order.user_id || pick(customers.length ? customers : users).id,
      product_id: order.product_id,
      quantity: qty,
      refund_amount: Number((Number(order.unit_price) * qty).toFixed(2)),
      currency: 'USD',
      reason: pick(RETURN_REASONS),
      status: pick(RETURN_STATUSES),
      created_at: stamp,
      seed_run: run,
    });
  }

  const transfers = [];
  for (let i = 0; i < config.seed.transfers; i += 1) {
    const product = pick(products);
    let toDealer = pick(dealers);
    if (toDealer.id === product.dealer_id && dealers.length > 1) {
      toDealer = dealers.find((d) => d.id !== product.dealer_id) || toDealer;
    }

    transfers.push({
      id: shortId('trn'),
      product_id: product.id,
      from_dealer_id: product.dealer_id,
      to_dealer_id: toDealer.id,
      quantity: Math.floor(Math.random() * 5) + 1,
      status: pick(TRANSFER_STATUSES),
      notes: `Transfer seeded for run ${run}`,
      created_by: users[0].id,
      created_at: stamp,
      seed_run: run,
    });
  }

  return {
    users,
    dealers,
    products,
    product_details: productDetails,
    payments,
    purchases,
    orders,
    stock_movements,
    returns,
    transfers,
    run,
    stamp,
  };
}

async function seed() {
  ensureDirs();
  const dataset = await buildDataset();

  const schemas = {
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
    returns: [
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
    ],
    transfers: [
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
    ],
  };

  for (const [entity, headers] of Object.entries(schemas)) {
    const rows = dataset[entity];
    writeCsv(entity, headers, rows);
    writeSeedJson(entity, rows);
  }

  console.log('CSV database regenerated with new values.');
  console.log(`Seed run: ${dataset.run}`);
  console.log(`CSV dir:  ${CSV_DIR}`);
  console.log(`Seed dir: ${SEED_DIR}`);
  console.log('Counts:', {
    users: dataset.users.length,
    dealers: dataset.dealers.length,
    products: dataset.products.length,
    product_details: dataset.product_details.length,
    payments: dataset.payments.length,
    purchases: dataset.purchases.length,
    orders: dataset.orders.length,
    stock_movements: dataset.stock_movements.length,
    returns: dataset.returns.length,
    transfers: dataset.transfers.length,
  });
  console.log('Demo logins:');
  console.log('  superadmin@commerce.local / Super@123  (super_admin)');
  console.log('  admin@commerce.local / Admin@123       (admin)');
  console.log('  customer@commerce.local / Password@123 (customer)');
  console.log('  dealer@commerce.local / Password@123   (dealer)');
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
