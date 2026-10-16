/**
 * Generates commerce-api.postman_collection.json and
 * commerce-api.postman_environment.json from the live Local Commerce API contract.
 * Run: node postman/generate-collection.js
 */
const fs = require('fs');
const path = require('path');

const str = { type: 'string' };
const num = { type: ['number', 'string'] };
const bool = { type: 'boolean' };
const nullableStr = { type: ['string', 'null'] };

function obj(required, properties) {
  return {
    type: 'object',
    required,
    properties,
    additionalProperties: true,
  };
}

function list(arrayKey, itemSchema) {
  return obj(['total', arrayKey], {
    total: { type: 'number' },
    [arrayKey]: { type: 'array', items: itemSchema },
  });
}

function msgEntity(messageEnum, entityKey, entitySchema) {
  return obj(['message', entityKey], {
    message: { type: 'string', ...(messageEnum ? { enum: messageEnum } : {}) },
    [entityKey]: entitySchema,
  });
}

const user = obj(
  ['id', 'email', 'first_name', 'last_name', 'role'],
  {
    id: str,
    email: str,
    first_name: str,
    last_name: str,
    role: { type: 'string', enum: ['customer', 'dealer', 'admin', 'super_admin'] },
    city: str,
    created_at: str,
    seed_run: str,
  }
);

const dealer = obj(
  ['id', 'name', 'code', 'region', 'status', 'contact_email'],
  {
    id: str,
    name: str,
    code: str,
    region: str,
    status: str,
    contact_email: str,
    created_at: str,
    seed_run: str,
  }
);

const product = obj(
  ['id', 'dealer_id', 'name', 'sku', 'category', 'price', 'currency', 'stock', 'status'],
  {
    id: str,
    dealer_id: str,
    name: str,
    sku: str,
    category: str,
    price: num,
    currency: str,
    stock: num,
    status: str,
    created_at: str,
    seed_run: str,
  }
);

const productDetail = obj(
  ['id', 'product_id', 'description'],
  {
    id: str,
    product_id: str,
    description: str,
    warranty_months: num,
    weight_kg: num,
    color: str,
    dimensions: str,
    created_at: str,
    seed_run: str,
  }
);

const payment = obj(
  ['id', 'user_id', 'amount', 'currency', 'method', 'status', 'reference'],
  {
    id: str,
    user_id: str,
    amount: num,
    currency: str,
    method: str,
    status: str,
    reference: str,
    created_at: str,
    seed_run: str,
  }
);

const purchase = obj(
  ['id', 'user_id', 'product_id', 'payment_id', 'quantity', 'status'],
  {
    id: str,
    user_id: str,
    product_id: str,
    payment_id: str,
    dealer_id: str,
    quantity: num,
    unit_price: num,
    total_amount: num,
    currency: str,
    confirmation_code: str,
    status: str,
    confirmed_at: str,
    seed_run: str,
  }
);

const order = obj(
  ['id', 'type', 'product_id', 'quantity', 'status'],
  {
    id: str,
    type: str,
    user_id: str,
    dealer_id: str,
    product_id: str,
    payment_id: str,
    quantity: num,
    unit_price: num,
    total_amount: num,
    currency: str,
    status: str,
    reference: str,
    notes: str,
    created_at: str,
    seed_run: str,
  }
);

const movement = obj(
  ['id', 'product_id', 'type', 'direction', 'quantity'],
  {
    id: str,
    product_id: str,
    dealer_id: str,
    type: str,
    direction: { type: 'string', enum: ['in', 'out'] },
    quantity: num,
    stock_before: num,
    stock_after: num,
    reference_id: str,
    reference_type: str,
    reason: str,
    performed_by: str,
    created_at: str,
    seed_run: str,
  }
);

const stockRow = obj(
  ['product_id', 'sku', 'name', 'dealer_id', 'stock', 'status'],
  {
    product_id: str,
    sku: str,
    name: str,
    dealer_id: str,
    stock: num,
    status: str,
    currency: str,
    price: num,
  }
);

const returnRow = obj(
  ['id', 'order_id', 'product_id', 'quantity', 'status'],
  {
    id: str,
    order_id: str,
    user_id: str,
    product_id: str,
    quantity: num,
    refund_amount: num,
    currency: str,
    reason: str,
    status: str,
    created_at: str,
    seed_run: str,
  }
);

const transfer = obj(
  ['id', 'product_id', 'from_dealer_id', 'to_dealer_id', 'quantity', 'status'],
  {
    id: str,
    product_id: str,
    from_dealer_id: str,
    to_dealer_id: str,
    quantity: num,
    status: str,
    notes: str,
    created_by: str,
    created_at: str,
    seed_run: str,
  }
);

const errorEnvelope = obj(['error', 'message'], {
  error: str,
  message: str,
  reason: str,
  existing: { type: 'object' },
});

const schemas = {
  error: errorEnvelope,
  health: obj(['status', 'timestamp', 'counts'], {
    status: { type: 'string', enum: ['ok'] },
    timestamp: str,
    base_url: str,
    seed_run: nullableStr,
    dashboard: str,
    counts: obj(
      [
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
      ],
      {
        users: { type: 'number' },
        dealers: { type: 'number' },
        products: { type: 'number' },
        product_details: { type: 'number' },
        payments: { type: 'number' },
        purchases: { type: 'number' },
        orders: { type: 'number' },
        stock_movements: { type: 'number' },
        returns: { type: 'number' },
        transfers: { type: 'number' },
      }
    ),
  }),
  apiInfo: obj(['name', 'version', 'auth', 'endpoints'], {
    name: str,
    version: str,
    base_url: str,
    dashboard: str,
    storage: { type: 'object' },
    auth: { type: 'object' },
    endpoints: { type: 'object' },
  }),
  seedMeta: obj(['csv_exists', 'seeds'], {
    csv_exists: bool,
    seeds: { type: 'object' },
  }),
  productMeta: obj(['price_min', 'price_max', 'price_step', 'rules'], {
    price_min: { type: 'number' },
    price_max: { type: 'number' },
    price_step: { type: 'number' },
    rules: obj(['unique_sku', 'unique_dealer_name_category_price', 'price_type'], {
      unique_sku: bool,
      unique_dealer_name_category_price: bool,
      price_type: str,
    }),
  }),
  login: obj(['access_token', 'token_type', 'expires_in', 'user'], {
    access_token: { type: 'string', minLength: 20 },
    token_type: { type: 'string', enum: ['Bearer'] },
    expires_in: str,
    user,
  }),
  me: user,
  permissions: obj(['role', 'permissions'], {
    role: str,
    permissions: obj(['role', 'initial', 'read'], {
      role: str,
      initial: { type: 'string', enum: ['CU', 'DL', 'AD', 'SA', 'NA'] },
      read: bool,
      create_customers: bool,
      update_customers: bool,
      create_dealers: bool,
      update_dealers: bool,
      delete_any: bool,
      delete_products: bool,
      manage_dealers: bool,
      manage_products: bool,
      manage_product_details: bool,
      manage_product_state: bool,
      manage_inventory: bool,
      manage_payments: bool,
      stock_ops: bool,
      stock_out_with_price: bool,
      buy: bool,
      sell: bool,
      transfers: bool,
      dashboard: bool,
      bypass_blockers: bool,
    }),
  }),
  dashboard: obj(['generated_at', 'entities'], {
    generated_at: str,
    seed_run: nullableStr,
    entities: { type: 'object' },
  }),
  user,
  usersList: list('users', user),
  userCreated: msgEntity(['User created'], 'user', user),
  userUpdated: msgEntity(['User updated'], 'user', user),
  userDeleted: msgEntity(['User deleted'], 'user', user),
  dealer,
  dealersList: list('dealers', dealer),
  dealerUpdated: msgEntity(['Dealer updated'], 'dealer', dealer),
  dealerDeleted: obj(['message', 'dealer'], {
    message: str,
    dealer,
    cascaded_products: { type: 'number' },
  }),
  product,
  productsList: list('products', product),
  productUpdated: msgEntity(['Product updated', 'Product state updated'], 'product', product),
  productDeleted: msgEntity(['Product deleted'], 'product', product),
  productWithDetails: obj(['product'], {
    product,
    details: { oneOf: [productDetail, { type: 'null' }] },
  }),
  productDetail,
  productDetailsList: list('product_details', productDetail),
  productDetailUpdated: msgEntity(['Product details updated'], 'product_detail', productDetail),
  productDetailDeleted: msgEntity(['Product details deleted'], 'product_detail', productDetail),
  payment,
  paymentsList: list('payments', payment),
  userPayments: obj(['user_id', 'total', 'payments'], {
    user_id: str,
    total: { type: 'number' },
    payments: { type: 'array', items: payment },
  }),
  paymentUpdated: msgEntity(['Payment updated'], 'payment', payment),
  paymentDeleted: msgEntity(['Payment deleted'], 'payment', payment),
  purchase,
  purchasesList: list('purchases', purchase),
  purchaseConfirm: obj(['message', 'purchase'], {
    message: { type: 'string', enum: ['Purchase confirmed'] },
    purchase,
    stock_movement: movement,
  }),
  stockList: list('stock', stockRow),
  stockItem: obj(['product_id', 'sku', 'name', 'dealer_id', 'stock', 'status'], {
    product_id: str,
    sku: str,
    name: str,
    dealer_id: str,
    stock: num,
    status: str,
    recent_movements: { type: 'array', items: movement },
  }),
  stockMovements: list('movements', movement),
  stockAdd: obj(['message', 'stock', 'movement'], {
    message: { type: 'string', enum: ['Stock added'] },
    stock: num,
    movement,
  }),
  stockOut: obj(['message', 'stock', 'product', 'movement'], {
    message: str,
    stock: num,
    unit_price: { type: ['number', 'string', 'null'] },
    product,
    movement,
    order: { oneOf: [order, { type: 'null' }] },
  }),
  stockAdjust: obj(['message', 'stock_before', 'stock_after', 'movement'], {
    message: { type: 'string', enum: ['Stock adjusted'] },
    stock_before: num,
    stock_after: num,
    movement,
  }),
  buy: obj(['message', 'order', 'payment'], {
    message: { type: 'string', enum: ['Buy completed'] },
    order,
    payment,
    stock_movement: movement,
  }),
  sell: obj(['message', 'order'], {
    message: { type: 'string', enum: ['Sell completed'] },
    order,
    stock_movement: movement,
  }),
  order,
  ordersList: list('orders', order),
  orderUpdated: msgEntity(['Order updated'], 'order', order),
  orderDeleted: msgEntity(['Order deleted'], 'order', order),
  returnRow,
  returnsList: list('returns', returnRow),
  returnCreated: obj(['message', 'return'], {
    message: str,
    return: returnRow,
    stock_movement: movement,
  }),
  transfer,
  transfersList: list('transfers', transfer),
  transferCreated: obj(['message', 'transfer'], {
    message: { type: 'string', enum: ['Transfer completed'] },
    transfer,
    source_movement: movement,
    destination_movement: movement,
    destination_product_id: str,
  }),
};

const collectionPrerequest = [
  'const ts = Date.now();',
  'const rand = Math.floor(Math.random() * 100000);',
  "pm.environment.set('uniqueTs', String(ts));",
  "pm.environment.set('uniqueSku', 'SKU-QA-' + ts + '-' + rand);",
  "pm.environment.set('uniqueEmail', 'qa.' + ts + '.' + rand + '@example.com');",
  "pm.environment.set('uniqueDealerCode', 'DLR-QA-' + ts);",
  "pm.environment.set('uniqueDealerEmail', 'dealer.qa.' + ts + '@example.com');",
  "pm.variables.set('expectedStatus', '');",
  "pm.variables.set('schemaName', '');",
].join('\n');

const collectionTests = `const SCHEMAS = ${JSON.stringify(schemas, null, 2)};

const RESPONSE_TIME_MAX = Number(pm.collectionVariables.get('responseTimeMax')) || 3000;

pm.test('Collection: response time is under ' + RESPONSE_TIME_MAX + 'ms', function () {
  pm.expect(pm.response.responseTime).to.be.below(RESPONSE_TIME_MAX);
});

pm.test('Collection: Content-Type is JSON', function () {
  const ct = pm.response.headers.get('Content-Type') || '';
  pm.expect(ct.toLowerCase()).to.include('application/json');
});

let body = null;
let parseError = null;
try {
  body = pm.response.json();
} catch (err) {
  parseError = err;
}

pm.test('Collection: body is valid JSON', function () {
  pm.expect(parseError, parseError && parseError.message).to.equal(null);
  pm.expect(body).to.exist;
});

const expectedStatus = Number(pm.variables.get('expectedStatus'));
if (expectedStatus) {
  pm.test('Collection: status is ' + expectedStatus, function () {
    pm.response.to.have.status(expectedStatus);
  });
}

if (body && pm.response.code >= 400) {
  pm.test('Collection: error envelope schema', function () {
    pm.response.to.have.jsonSchema(SCHEMAS.error);
  });
}

const schemaName = pm.variables.get('schemaName');
if (body && schemaName && SCHEMAS[schemaName] && pm.response.code < 400) {
  pm.test('Collection: JSON schema [' + schemaName + ']', function () {
    pm.response.to.have.jsonSchema(SCHEMAS[schemaName]);
  });
}

if (body && typeof body.total === 'number') {
  const listKeys = [
    'users', 'dealers', 'products', 'product_details', 'payments',
    'purchases', 'orders', 'stock', 'movements', 'returns', 'transfers'
  ];
  const matched = listKeys.find((key) => Array.isArray(body[key]));
  if (matched) {
    pm.test('Collection: list total matches ' + matched + '.length', function () {
      pm.expect(body.total).to.eql(body[matched].length);
    });
  }
}

function setEnv(key, value, overwrite) {
  if (value === undefined || value === null || value === '') return;
  const current = pm.environment.get(key);
  if (overwrite || !current) {
    pm.environment.set(key, String(value));
  }
}

if (body && pm.response.code >= 200 && pm.response.code < 300) {
  if (body.access_token && body.user) {
    const roleMap = { customer: 'CU', dealer: 'DL', admin: 'AD', super_admin: 'SA' };
    const prefix = roleMap[body.user.role];
    if (prefix) {
      setEnv(prefix + '_token', body.access_token, true);
      setEnv(prefix + '_userId', body.user.id, true);
      setEnv(prefix + '_role', body.user.role, true);
    }
    setEnv('accessToken', body.access_token, true);
    setEnv('userId', body.user.id, true);
  }

  const created = pm.response.code === 201;
  const id = body.id || body.user && body.user.id || body.product && body.product.id || body.dealer && body.dealer.id;
  const prefix = typeof id === 'string' ? id.split('_')[0] : '';
  const createdMap = {
    usr: 'createdUserId',
    dlr: 'createdDealerId',
    prd: 'createdProductId',
    pdt: 'createdProductDetailId',
    pay: 'createdPaymentId',
    pur: 'createdPurchaseId',
    ord: 'createdOrderId',
    ret: 'createdReturnId',
    trn: 'createdTransferId'
  };
  if (created && prefix && createdMap[prefix]) {
    setEnv(createdMap[prefix], id, true);
  }

  if (body.user && body.user.id && created) setEnv('createdUserId', body.user.id, true);
  if (body.dealer && body.dealer.id) setEnv('createdDealerId', body.dealer.id, created);
  if (body.product && body.product.id) setEnv('createdProductId', body.product.id, created);
  if (body.product_detail && body.product_detail.id) setEnv('createdProductDetailId', body.product_detail.id, created);
  if (body.payment && body.payment.id) setEnv('createdPaymentId', body.payment.id, created);
  if (body.purchase && body.purchase.id) setEnv('createdPurchaseId', body.purchase.id, true);
  if (body.order && body.order.id) {
    setEnv('createdOrderId', body.order.id, false);
    if (body.order.type === 'buy') setEnv('buyOrderId', body.order.id, true);
    if (body.order.type === 'sell') setEnv('sellOrderId', body.order.id, false);
  }
  if (body.return && body.return.id) setEnv('createdReturnId', body.return.id, true);
  if (body.transfer && body.transfer.id) setEnv('createdTransferId', body.transfer.id, true);
  if (body.sku) setEnv('createdSku', body.sku, created);

  if (Array.isArray(body.dealers) && body.dealers.length) {
    setEnv('dealerId', body.dealers[0].id, false);
    if (body.dealers[1]) setEnv('dealerId2', body.dealers[1].id, false);
  }
  if (Array.isArray(body.products) && body.products.length) {
    const withStock = body.products.find((row) => Number(row.stock) > 1) || body.products[0];
    setEnv('productId', withStock.id, false);
  }
  if (Array.isArray(body.payments) && body.payments[0]) setEnv('paymentId', body.payments[0].id, false);
  if (Array.isArray(body.orders) && body.orders[0]) setEnv('orderId', body.orders[0].id, false);
  if (Array.isArray(body.users) && body.users[0]) setEnv('listedUserId', body.users[0].id, false);
  if (Array.isArray(body.product_details) && body.product_details[0]) {
    setEnv('productDetailId', body.product_details[0].id, false);
  }
}
`.trim();

function lines(code) {
  return String(code).replace(/^\n/, '').replace(/\n$/, '').split('\n');
}

function event(listen, code) {
  return {
    listen,
    script: {
      type: 'text/javascript',
      exec: lines(code),
    },
  };
}

function expect(status, schemaName, extra = '') {
  const prerequest = [
    `pm.variables.set('expectedStatus', '${status}');`,
    `pm.variables.set('schemaName', '${schemaName || ''}');`,
  ].join('\n');

  const tests = `
pm.test('Request: status is ${status}', function () {
  pm.response.to.have.status(${status});
});

let json = null;
pm.test('Request: response is JSON', function () {
  json = pm.response.json();
  pm.expect(json).to.be.an('object');
});
json = pm.response.json();
${schemaName && status < 400 ? `
pm.test('Request: JSON schema [${schemaName}]', function () {
  pm.response.to.have.jsonSchema(JSON.parse(pm.collectionVariables.get('jsonSchemas'))['${schemaName}']);
});
` : ''}
${status >= 400 ? `
pm.test('Request: error envelope', function () {
  pm.expect(json).to.include.keys('error', 'message');
  pm.expect(json.error).to.be.a('string');
  pm.expect(json.message).to.be.a('string');
});
` : ''}
${extra}
`.trim();

  return [event('prerequest', prerequest), event('test', tests)];
}

function jsonBody(obj) {
  return {
    mode: 'raw',
    raw: JSON.stringify(obj, null, 2),
    options: { raw: { language: 'json' } },
  };
}

function headers(extra = []) {
  return extra;
}

function jsonHeaders() {
  return [{ key: 'Content-Type', value: 'application/json' }];
}

function noauth() {
  return { type: 'noauth' };
}

function bearer(tokenVar) {
  return {
    type: 'bearer',
    bearer: [{ key: 'token', value: `{{${tokenVar}}}`, type: 'string' }],
  };
}

function req({
  name,
  method,
  url,
  body,
  auth,
  status,
  schema,
  extraTests = '',
  description = '',
  header = [],
}) {
  const item = {
    name,
    event: expect(status, schema, extraTests),
    request: {
      method,
      header: body ? [...jsonHeaders(), ...header] : header,
      url,
    },
  };
  if (description) item.request.description = description;
  if (auth) item.request.auth = auth;
  if (body) item.request.body = typeof body === 'string' ? jsonBody(JSON.parse(body)) : jsonBody(body);
  return item;
}

const collection = {
  info: {
    _postman_id: 'commerce-api-complete-001',
    name: 'Local Commerce API',
    description: [
      'Complete collection for Local Commerce API (http://localhost:3002).',
      '',
      'Import this collection **and** `commerce-api.postman_environment.json`.',
      'Start the server first: `npm start` in `API Testing/Local_Commerce_API`.',
      '',
      'Validation layers:',
      '1. **Collection** — JSON content-type, response time, parse, dynamic expected status, error envelope, list totals, JSON schema lookup, ID harvesting.',
      '2. **Request** — status, schema, business assertions, and env captures.',
      '',
      'Run folder **00 Setup** first so tokens and seed IDs are populated.',
      'Demo users: CU customer@commerce.local / Password@123 · DL dealer@commerce.local / Password@123 · AD admin@commerce.local / Admin@123 · SA superadmin@commerce.local / Super@123.',
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: bearer('accessToken'),
  variable: [
    { key: 'responseTimeMax', value: '3000' },
    { key: 'jsonSchemas', value: JSON.stringify(schemas) },
  ],
  event: [
    event('prerequest', collectionPrerequest),
    event('test', collectionTests),
  ],
  item: [],
};

collection.item = [
  {
    name: '00 Setup',
    item: [
      req({
        name: 'Health',
        method: 'GET',
        url: '{{baseUrl}}/health',
        auth: noauth(),
        status: 200,
        schema: 'health',
        extraTests: `
pm.test('Request: status is ok and counts are numbers', function () {
  pm.expect(json.status).to.eql('ok');
  pm.expect(json.counts.products).to.be.a('number').and.at.least(1);
});
if (json.seed_run) pm.environment.set('seedRun', json.seed_run);
`,
      }),
      req({
        name: 'API info',
        method: 'GET',
        url: '{{baseUrl}}/',
        auth: noauth(),
        status: 200,
        schema: 'apiInfo',
        extraTests: `
pm.test('Request: service name and login path', function () {
  pm.expect(json.name).to.eql('Local Commerce API');
  pm.expect(json.auth.login).to.include('/api/auth/login');
});
`,
      }),
      req({
        name: 'Seed meta',
        method: 'GET',
        url: '{{baseUrl}}/meta/seed',
        auth: noauth(),
        status: 200,
        schema: 'seedMeta',
        extraTests: `
pm.test('Request: CSV store exists', function () {
  pm.expect(json.csv_exists).to.eql(true);
  pm.expect(json.seeds.products).to.be.at.least(1);
});
`,
      }),
      req({
        name: 'Product price rules',
        method: 'GET',
        url: '{{baseUrl}}/api/meta/products',
        auth: noauth(),
        status: 200,
        schema: 'productMeta',
        extraTests: `
pm.test('Request: price bounds are usable floats', function () {
  pm.expect(json.price_min).to.be.a('number');
  pm.expect(json.price_max).to.be.above(json.price_min);
  pm.expect(json.rules.unique_sku).to.eql(true);
});
pm.environment.set('PRODUCT_PRICE_MIN', String(json.price_min));
pm.environment.set('PRODUCT_PRICE_MAX', String(json.price_max));
`,
      }),
      req({
        name: 'Login customer (CU)',
        method: 'POST',
        url: '{{baseUrl}}/api/auth/login',
        auth: noauth(),
        status: 200,
        schema: 'login',
        body: { email: '{{CU_email}}', password: '{{CU_password}}' },
        extraTests: `
pm.test('Request: customer role and bearer token', function () {
  pm.expect(json.token_type).to.eql('Bearer');
  pm.expect(json.user.role).to.eql('customer');
  pm.expect(json.access_token.length).to.be.above(20);
});
`,
      }),
      req({
        name: 'Login dealer (DL)',
        method: 'POST',
        url: '{{baseUrl}}/api/auth/login',
        auth: noauth(),
        status: 200,
        schema: 'login',
        body: { email: '{{DL_email}}', password: '{{DL_password}}' },
        extraTests: `
pm.test('Request: dealer role', function () {
  pm.expect(json.user.role).to.eql('dealer');
});
`,
      }),
      req({
        name: 'Login admin (AD)',
        method: 'POST',
        url: '{{baseUrl}}/api/auth/login',
        auth: noauth(),
        status: 200,
        schema: 'login',
        body: { email: '{{AD_email}}', password: '{{AD_password}}' },
        extraTests: `
pm.test('Request: admin role', function () {
  pm.expect(json.user.role).to.eql('admin');
});
`,
      }),
      req({
        name: 'Login super admin (SA)',
        method: 'POST',
        url: '{{baseUrl}}/api/auth/login',
        auth: noauth(),
        status: 200,
        schema: 'login',
        body: { email: '{{SA_email}}', password: '{{SA_password}}' },
        extraTests: `
pm.test('Request: super_admin role and default accessToken', function () {
  pm.expect(json.user.role).to.eql('super_admin');
  pm.expect(pm.environment.get('accessToken')).to.eql(json.access_token);
});
`,
      }),
      req({
        name: 'Bootstrap dealers',
        method: 'GET',
        url: '{{baseUrl}}/api/dealers',
        status: 200,
        schema: 'dealersList',
        extraTests: `
pm.test('Request: at least two dealers for transfers', function () {
  pm.expect(json.dealers.length).to.be.at.least(2);
});
pm.environment.set('dealerId', json.dealers[0].id);
pm.environment.set('dealerId2', json.dealers[1].id);
pm.environment.set('DL_dealerId', json.dealers[0].id);
`,
      }),
      req({
        name: 'Bootstrap products',
        method: 'GET',
        url: '{{baseUrl}}/api/products',
        status: 200,
        schema: 'productsList',
        extraTests: `
const withStock = json.products.find((row) => Number(row.stock) > 1) || json.products[0];
pm.test('Request: seeded products exist', function () {
  pm.expect(withStock, 'a product with stock').to.exist;
});
if (withStock) {
  pm.environment.set('productId', withStock.id);
  pm.environment.set('AD_productId', withStock.id);
}
`,
      }),
      req({
        name: 'Bootstrap users',
        method: 'GET',
        url: '{{baseUrl}}/api/users',
        status: 200,
        schema: 'usersList',
        extraTests: `
pm.test('Request: seeded users include all four roles', function () {
  const roles = json.users.map((row) => row.role);
  pm.expect(roles).to.include.members(['customer', 'dealer', 'admin', 'super_admin']);
});
`,
      }),
    ],
  },
  {
    name: '01 Auth',
    item: [
      req({
        name: 'Get me',
        method: 'GET',
        url: '{{baseUrl}}/api/auth/me',
        status: 200,
        schema: 'me',
        extraTests: `
pm.test('Request: me matches logged-in SA user', function () {
  pm.expect(json.role).to.eql('super_admin');
  pm.expect(json.id).to.eql(pm.environment.get('SA_userId'));
  pm.expect(json).to.not.have.property('password');
  pm.expect(json).to.not.have.property('password_hash');
});
`,
      }),
      req({
        name: 'Get permissions',
        method: 'GET',
        url: '{{baseUrl}}/api/auth/permissions',
        status: 200,
        schema: 'permissions',
        extraTests: `
pm.test('Request: SA has unrestricted flags', function () {
  pm.expect(json.permissions.initial).to.eql('SA');
  pm.expect(json.permissions.delete_any).to.eql(true);
  pm.expect(json.permissions.bypass_blockers).to.eql(true);
});
`,
      }),
      req({
        name: 'Get me without token',
        method: 'GET',
        url: '{{baseUrl}}/api/auth/me',
        auth: noauth(),
        status: 401,
        extraTests: `
pm.test('Request: unauthorized message', function () {
  pm.expect(json.error).to.eql('Unauthorized');
});
`,
      }),
      req({
        name: 'Login missing fields',
        method: 'POST',
        url: '{{baseUrl}}/api/auth/login',
        auth: noauth(),
        status: 400,
        body: { email: '' },
      }),
      req({
        name: 'Login invalid credentials',
        method: 'POST',
        url: '{{baseUrl}}/api/auth/login',
        auth: noauth(),
        status: 401,
        body: { email: '{{CU_email}}', password: 'WrongPassword!' },
        extraTests: `
pm.test('Request: invalid credentials error', function () {
  pm.expect(json.error).to.eql('Unauthorized');
});
`,
      }),
    ],
  },
  {
    name: '02 Users',
    item: [
      req({
        name: 'List users',
        method: 'GET',
        url: '{{baseUrl}}/api/users',
        status: 200,
        schema: 'usersList',
        extraTests: `
pm.test('Request: users are sanitized', function () {
  json.users.forEach((row) => {
    pm.expect(row).to.not.have.property('password');
    pm.expect(row).to.not.have.property('password_hash');
  });
});
`,
      }),
      req({
        name: 'Get user by id',
        method: 'GET',
        url: '{{baseUrl}}/api/users/{{SA_userId}}',
        status: 200,
        schema: 'user',
        extraTests: `
pm.test('Request: returned user matches SA', function () {
  pm.expect(json.id).to.eql(pm.environment.get('SA_userId'));
  pm.expect(json.email).to.eql(pm.environment.get('SA_email'));
});
`,
      }),
      req({
        name: 'Create user',
        method: 'POST',
        url: '{{baseUrl}}/api/users',
        status: 201,
        schema: 'userCreated',
        body: {
          email: '{{uniqueEmail}}',
          password: 'Password@123',
          first_name: 'QA',
          last_name: 'Created',
          role: 'customer',
          city: 'Dhaka',
        },
        extraTests: `
pm.test('Request: created customer has usr_ id', function () {
  pm.expect(json.message).to.eql('User created');
  pm.expect(json.user.id).to.match(/^usr_/);
  pm.expect(json.user.role).to.eql('customer');
});
pm.environment.set('createdUserId', json.user.id);
pm.environment.set('createdUserEmail', json.user.email);
pm.environment.set('AD_customerId', json.user.id);
`,
      }),
      req({
        name: 'Update user',
        method: 'PUT',
        url: '{{baseUrl}}/api/users/{{createdUserId}}',
        status: 200,
        schema: 'userUpdated',
        body: { city: 'Singapore', first_name: 'Updated' },
        extraTests: `
pm.test('Request: city and first_name updated', function () {
  pm.expect(json.user.city).to.eql('Singapore');
  pm.expect(json.user.first_name).to.eql('Updated');
  pm.expect(json.user.id).to.eql(pm.environment.get('createdUserId'));
});
`,
      }),
      req({
        name: 'Get user payments',
        method: 'GET',
        url: '{{baseUrl}}/api/users/{{CU_userId}}/payments',
        status: 200,
        schema: 'userPayments',
        extraTests: `
pm.test('Request: payments belong to CU user', function () {
  pm.expect(json.user_id).to.eql(pm.environment.get('CU_userId'));
  json.payments.forEach((row) => pm.expect(row.user_id).to.eql(json.user_id));
});
`,
      }),
      req({
        name: 'Create user for delete',
        method: 'POST',
        url: '{{baseUrl}}/api/users',
        status: 201,
        schema: 'userCreated',
        body: {
          email: 'delete.{{uniqueTs}}@example.com',
          password: 'Password@123',
          first_name: 'Delete',
          last_name: 'Me',
          role: 'customer',
        },
        extraTests: `
pm.environment.set('deleteUserId', json.user.id);
pm.environment.set('SA_targetId', json.user.id);
`,
      }),
    ],
  },
  {
    name: '03 Dealers',
    item: [
      req({
        name: 'List dealers',
        method: 'GET',
        url: '{{baseUrl}}/api/dealers',
        status: 200,
        schema: 'dealersList',
      }),
      req({
        name: 'Get dealer by id',
        method: 'GET',
        url: '{{baseUrl}}/api/dealers/{{dealerId}}',
        status: 200,
        schema: 'dealer',
        extraTests: `
pm.test('Request: dealer id matches path', function () {
  pm.expect(json.id).to.eql(pm.environment.get('dealerId'));
});
`,
      }),
      req({
        name: 'Create dealer',
        method: 'POST',
        url: '{{baseUrl}}/api/dealers',
        status: 201,
        schema: 'dealer',
        body: {
          name: 'QA Dealer Hub',
          code: '{{uniqueDealerCode}}',
          region: 'Austin',
          contact_email: '{{uniqueDealerEmail}}',
          status: 'active',
        },
        extraTests: `
pm.test('Request: created dealer has dlr_ id', function () {
  pm.expect(json.id).to.match(/^dlr_/);
  pm.expect(json.status).to.eql('active');
});
pm.environment.set('createdDealerId', json.id);
pm.environment.set('AD_dealerId', json.id);
`,
      }),
      req({
        name: 'Update dealer',
        method: 'PUT',
        url: '{{baseUrl}}/api/dealers/{{createdDealerId}}',
        status: 200,
        schema: 'dealerUpdated',
        body: { region: 'Singapore', status: 'active' },
        extraTests: `
pm.test('Request: region updated', function () {
  pm.expect(json.dealer.region).to.eql('Singapore');
  pm.expect(json.dealer.id).to.eql(pm.environment.get('createdDealerId'));
});
`,
      }),
      req({
        name: 'Create dealer for force delete',
        method: 'POST',
        url: '{{baseUrl}}/api/dealers',
        status: 201,
        schema: 'dealer',
        body: {
          name: 'Disposable Dealer',
          code: 'DLR-DEL-{{uniqueTs}}',
          region: 'Test',
          contact_email: 'disposable.{{uniqueTs}}@example.com',
        },
        extraTests: `pm.environment.set('deleteDealerId', json.id);`,
      }),
    ],
  },
  {
    name: '04 Products',
    item: [
      req({
        name: 'List products',
        method: 'GET',
        url: '{{baseUrl}}/api/products',
        status: 200,
        schema: 'productsList',
      }),
      req({
        name: 'List products by status',
        method: 'GET',
        url: '{{baseUrl}}/api/products?status=active',
        status: 200,
        schema: 'productsList',
        extraTests: `
pm.test('Request: filtered products are active', function () {
  json.products.forEach((row) => pm.expect(row.status).to.eql('active'));
});
`,
      }),
      req({
        name: 'Get product by id',
        method: 'GET',
        url: '{{baseUrl}}/api/products/{{productId}}',
        status: 200,
        schema: 'product',
        extraTests: `
pm.test('Request: product id matches path', function () {
  pm.expect(json.id).to.eql(pm.environment.get('productId'));
});
`,
      }),
      req({
        name: 'Get product with details',
        method: 'GET',
        url: '{{baseUrl}}/api/products/{{productId}}/details',
        status: 200,
        schema: 'productWithDetails',
        extraTests: `
pm.test('Request: nested product is present', function () {
  pm.expect(json.product.id).to.eql(pm.environment.get('productId'));
});
`,
      }),
      req({
        name: 'Create product',
        method: 'POST',
        url: '{{baseUrl}}/api/products',
        status: 201,
        schema: 'product',
        body: {
          dealer_id: '{{dealerId}}',
          name: 'QA Test Product',
          sku: '{{uniqueSku}}',
          category: 'electronics',
          price: 29.99,
          currency: 'USD',
          stock: 40,
          status: 'active',
        },
        extraTests: `
pm.test('Request: created product fields', function () {
  pm.expect(json.id).to.match(/^prd_/);
  pm.expect(Number(json.price)).to.eql(29.99);
  pm.expect(Number(json.stock)).to.eql(40);
  pm.expect(json.sku).to.eql(String(json.sku).toUpperCase());
});
pm.environment.set('createdProductId', json.id);
pm.environment.set('createdSku', json.sku);
pm.environment.set('DL_productId', json.id);
`,
      }),
      req({
        name: 'Update product',
        method: 'PUT',
        url: '{{baseUrl}}/api/products/{{createdProductId}}',
        status: 200,
        schema: 'productUpdated',
        body: { name: 'QA Updated Product', price: 34.5 },
        extraTests: `
pm.test('Request: name and price updated', function () {
  pm.expect(json.product.name).to.eql('QA Updated Product');
  pm.expect(Number(json.product.price)).to.eql(34.5);
});
`,
      }),
      req({
        name: 'Update product state',
        method: 'PUT',
        url: '{{baseUrl}}/api/products/{{createdProductId}}/state',
        status: 200,
        schema: 'productUpdated',
        body: { status: 'active', stock: 45 },
        extraTests: `
pm.test('Request: state stock and status', function () {
  pm.expect(json.message).to.eql('Product state updated');
  pm.expect(json.product.status).to.eql('active');
  pm.expect(Number(json.product.stock)).to.eql(45);
});
`,
      }),
    ],
  },
  {
    name: '05 Product Details',
    item: [
      req({
        name: 'List product details',
        method: 'GET',
        url: '{{baseUrl}}/api/product-details',
        status: 200,
        schema: 'productDetailsList',
      }),
      req({
        name: 'Create product details',
        method: 'POST',
        url: '{{baseUrl}}/api/product-details',
        status: 201,
        schema: 'productDetail',
        body: {
          product_id: '{{createdProductId}}',
          description: 'QA generated product details',
          warranty_months: 18,
          weight_kg: 1.25,
          color: 'black',
          dimensions: '10x5x2',
        },
        extraTests: `
pm.test('Request: details bound to created product', function () {
  pm.expect(json.id).to.match(/^pdt_/);
  pm.expect(json.product_id).to.eql(pm.environment.get('createdProductId'));
});
pm.environment.set('createdProductDetailId', json.id);
pm.environment.set('productDetailId', json.id);
`,
      }),
      req({
        name: 'Get product detail by id',
        method: 'GET',
        url: '{{baseUrl}}/api/product-details/{{createdProductDetailId}}',
        status: 200,
        schema: 'productDetail',
      }),
      req({
        name: 'List product details by product_id',
        method: 'GET',
        url: '{{baseUrl}}/api/product-details?product_id={{createdProductId}}',
        status: 200,
        schema: 'productDetailsList',
        extraTests: `
pm.test('Request: filter matches created product', function () {
  pm.expect(json.total).to.eql(1);
  pm.expect(json.product_details[0].product_id).to.eql(pm.environment.get('createdProductId'));
});
`,
      }),
      req({
        name: 'Update product details',
        method: 'PUT',
        url: '{{baseUrl}}/api/product-details/{{createdProductDetailId}}',
        status: 200,
        schema: 'productDetailUpdated',
        body: { color: 'silver', warranty_months: 24 },
        extraTests: `
pm.test('Request: color and warranty updated', function () {
  pm.expect(json.product_detail.color).to.eql('silver');
  pm.expect(Number(json.product_detail.warranty_months)).to.eql(24);
});
`,
      }),
    ],
  },
  {
    name: '06 Payments',
    item: [
      req({
        name: 'List payments',
        method: 'GET',
        url: '{{baseUrl}}/api/payments',
        status: 200,
        schema: 'paymentsList',
      }),
      req({
        name: 'Create payment',
        method: 'POST',
        url: '{{baseUrl}}/api/payments',
        status: 201,
        schema: 'payment',
        body: {
          amount: 42.5,
          currency: 'USD',
          method: 'card',
          status: 'pending',
        },
        extraTests: `
pm.test('Request: payment id and pending status', function () {
  pm.expect(json.id).to.match(/^pay_/);
  pm.expect(json.status).to.eql('pending');
  pm.expect(json.reference).to.be.a('string').and.not.empty;
});
pm.environment.set('createdPaymentId', json.id);
pm.environment.set('paymentId', json.id);
`,
      }),
      req({
        name: 'Get payment by id',
        method: 'GET',
        url: '{{baseUrl}}/api/payments/{{createdPaymentId}}',
        status: 200,
        schema: 'payment',
      }),
      req({
        name: 'Update payment',
        method: 'PUT',
        url: '{{baseUrl}}/api/payments/{{createdPaymentId}}',
        status: 200,
        schema: 'paymentUpdated',
        body: { status: 'authorized', method: 'card' },
        extraTests: `
pm.test('Request: payment authorized for purchase confirm', function () {
  pm.expect(json.payment.status).to.eql('authorized');
});
`,
      }),
      req({
        name: 'List payments by status',
        method: 'GET',
        url: '{{baseUrl}}/api/payments?status=authorized',
        status: 200,
        schema: 'paymentsList',
      }),
    ],
  },
  {
    name: '07 Purchases',
    item: [
      req({
        name: 'List purchases',
        method: 'GET',
        url: '{{baseUrl}}/api/purchases',
        status: 200,
        schema: 'purchasesList',
      }),
      req({
        name: 'Confirm purchase',
        method: 'POST',
        url: '{{baseUrl}}/api/purchases/confirm',
        status: 201,
        schema: 'purchaseConfirm',
        body: {
          product_id: '{{createdProductId}}',
          payment_id: '{{createdPaymentId}}',
          quantity: 1,
        },
        extraTests: `
pm.test('Request: purchase confirmed and stock moved out', function () {
  pm.expect(json.purchase.status).to.eql('confirmed');
  pm.expect(json.purchase.confirmation_code).to.match(/^CNF-/);
  pm.expect(json.stock_movement.direction).to.eql('out');
});
pm.environment.set('createdPurchaseId', json.purchase.id);
`,
      }),
      req({
        name: 'Get purchase by id',
        method: 'GET',
        url: '{{baseUrl}}/api/purchases/{{createdPurchaseId}}',
        status: 200,
        schema: 'purchase',
        extraTests: `
pm.test('Request: purchase id matches', function () {
  pm.expect(json.id).to.eql(pm.environment.get('createdPurchaseId'));
});
`,
      }),
    ],
  },
  {
    name: '08 Stock',
    item: [
      req({
        name: 'List stock',
        method: 'GET',
        url: '{{baseUrl}}/api/stock',
        status: 200,
        schema: 'stockList',
      }),
      req({
        name: 'List low stock',
        method: 'GET',
        url: '{{baseUrl}}/api/stock?low_stock=1000',
        status: 200,
        schema: 'stockList',
      }),
      req({
        name: 'List stock movements',
        method: 'GET',
        url: '{{baseUrl}}/api/stock/movements',
        status: 200,
        schema: 'stockMovements',
      }),
      req({
        name: 'Get stock by product',
        method: 'GET',
        url: '{{baseUrl}}/api/stock/{{createdProductId}}',
        status: 200,
        schema: 'stockItem',
        extraTests: `
pm.test('Request: stock snapshot matches created product', function () {
  pm.expect(json.product_id).to.eql(pm.environment.get('createdProductId'));
  pm.expect(json.recent_movements).to.be.an('array');
});
`,
      }),
      req({
        name: 'Stock add',
        method: 'POST',
        url: '{{baseUrl}}/api/stock/add',
        status: 201,
        schema: 'stockAdd',
        body: {
          product_id: '{{createdProductId}}',
          quantity: 5,
          reason: 'qa_restock',
        },
        extraTests: `
pm.test('Request: stock increased', function () {
  pm.expect(json.movement.direction).to.eql('in');
  pm.expect(Number(json.movement.quantity)).to.eql(5);
});
`,
      }),
      req({
        name: 'Stock out with price',
        method: 'POST',
        url: '{{baseUrl}}/api/stock/out',
        status: 201,
        schema: 'stockOut',
        body: {
          product_id: '{{createdProductId}}',
          quantity: 1,
          unit_price: 55.25,
          reason: 'qa_priced_out',
        },
        extraTests: `
pm.test('Request: priced stock-out creates sell order', function () {
  pm.expect(json.unit_price).to.eql(55.25);
  pm.expect(json.order).to.be.an('object');
  pm.expect(json.order.type).to.eql('sell');
  pm.expect(json.movement.direction).to.eql('out');
});
if (json.order && json.order.id) pm.environment.set('pricedOrderId', json.order.id);
`,
      }),
      req({
        name: 'Stock adjust',
        method: 'POST',
        url: '{{baseUrl}}/api/stock/adjust',
        status: 200,
        schema: 'stockAdjust',
        body: {
          product_id: '{{createdProductId}}',
          new_quantity: 30,
          reason: 'qa_inventory_manage',
        },
        extraTests: `
pm.test('Request: stock_after is 30', function () {
  pm.expect(Number(json.stock_after)).to.eql(30);
});
`,
      }),
    ],
  },
  {
    name: '09 Buy Sell Orders',
    item: [
      req({
        name: 'Customer buy',
        method: 'POST',
        url: '{{baseUrl}}/api/buy',
        auth: bearer('CU_token'),
        status: 201,
        schema: 'buy',
        body: {
          product_id: '{{productId}}',
          quantity: 1,
          method: 'card',
          notes: 'QA customer buy',
        },
        extraTests: `
pm.test('Request: buy creates order + captured payment', function () {
  pm.expect(json.order.type).to.eql('buy');
  pm.expect(json.order.status).to.eql('completed');
  pm.expect(json.payment.status).to.eql('captured');
  pm.expect(json.stock_movement.direction).to.eql('out');
});
pm.environment.set('createdOrderId', json.order.id);
pm.environment.set('buyOrderId', json.order.id);
pm.environment.set('orderId', json.order.id);
pm.environment.set('buyPaymentId', json.payment.id);
`,
      }),
      req({
        name: 'Dealer sell',
        method: 'POST',
        url: '{{baseUrl}}/api/sell',
        auth: bearer('DL_token'),
        status: 201,
        schema: 'sell',
        body: {
          product_id: '{{createdProductId}}',
          quantity: 1,
          unit_price: 59.99,
          buyer_name: 'walk-in',
        },
        extraTests: `
pm.test('Request: sell order completed', function () {
  pm.expect(json.order.type).to.eql('sell');
  pm.expect(Number(json.order.unit_price)).to.eql(59.99);
});
pm.environment.set('sellOrderId', json.order.id);
`,
      }),
      req({
        name: 'List orders',
        method: 'GET',
        url: '{{baseUrl}}/api/orders',
        status: 200,
        schema: 'ordersList',
      }),
      req({
        name: 'List buy orders',
        method: 'GET',
        url: '{{baseUrl}}/api/orders?type=buy',
        status: 200,
        schema: 'ordersList',
        extraTests: `
pm.test('Request: filtered orders are buy', function () {
  json.orders.forEach((row) => pm.expect(row.type).to.eql('buy'));
});
`,
      }),
      req({
        name: 'Get order by id',
        method: 'GET',
        url: '{{baseUrl}}/api/orders/{{createdOrderId}}',
        status: 200,
        schema: 'order',
      }),
      req({
        name: 'Update order',
        method: 'PUT',
        url: '{{baseUrl}}/api/orders/{{createdOrderId}}',
        status: 200,
        schema: 'orderUpdated',
        body: { status: 'completed', notes: 'QA updated notes' },
        extraTests: `
pm.test('Request: notes updated', function () {
  pm.expect(json.order.notes).to.eql('QA updated notes');
});
`,
      }),
    ],
  },
  {
    name: '10 Returns',
    item: [
      req({
        name: 'List returns',
        method: 'GET',
        url: '{{baseUrl}}/api/returns',
        status: 200,
        schema: 'returnsList',
      }),
      req({
        name: 'Create return',
        method: 'POST',
        url: '{{baseUrl}}/api/returns',
        auth: bearer('CU_token'),
        status: 201,
        schema: 'returnCreated',
        body: {
          order_id: '{{buyOrderId}}',
          quantity: 1,
          reason: 'customer_change_mind',
        },
        extraTests: `
pm.test('Request: return restores stock', function () {
  pm.expect(json.return).to.be.an('object');
  pm.expect(json.return.status).to.eql('approved');
  pm.expect(json.stock_movement.direction).to.eql('in');
  pm.expect(json.return.order_id).to.eql(pm.environment.get('buyOrderId'));
});
if (json.return && json.return.id) pm.environment.set('createdReturnId', json.return.id);
`,
      }),
    ],
  },
  {
    name: '11 Transfers',
    item: [
      req({
        name: 'List transfers',
        method: 'GET',
        url: '{{baseUrl}}/api/transfers',
        status: 200,
        schema: 'transfersList',
      }),
      req({
        name: 'Create transfer',
        method: 'POST',
        url: '{{baseUrl}}/api/transfers',
        auth: bearer('DL_token'),
        status: 201,
        schema: 'transferCreated',
        body: {
          product_id: '{{createdProductId}}',
          to_dealer_id: '{{dealerId2}}',
          quantity: 1,
          notes: 'QA dealer transfer',
        },
        extraTests: `
pm.test('Request: transfer completed to destination dealer', function () {
  pm.expect(json.transfer.status).to.eql('completed');
  pm.expect(json.transfer.to_dealer_id).to.eql(pm.environment.get('dealerId2'));
  pm.expect(json.source_movement.direction).to.eql('out');
  pm.expect(json.destination_movement.direction).to.eql('in');
});
pm.environment.set('createdTransferId', json.transfer.id);
pm.environment.set('destinationProductId', json.destination_product_id);
`,
      }),
    ],
  },
  {
    name: '12 Dashboard',
    item: [
      req({
        name: 'Dashboard snapshot',
        method: 'GET',
        url: '{{baseUrl}}/api/dashboard/snapshot',
        status: 200,
        schema: 'dashboard',
        extraTests: `
pm.test('Request: snapshot includes core entities', function () {
  pm.expect(json.entities).to.include.keys('users', 'dealers', 'products', 'orders');
  pm.expect(json.entities.users.totals.all).to.be.a('number');
});
`,
      }),
    ],
  },
  {
    name: '13 Negative & Authz',
    item: [
      req({
        name: 'CU delete product (expect 403)',
        method: 'DELETE',
        url: '{{baseUrl}}/api/products/{{productId}}',
        auth: bearer('CU_token'),
        status: 403,
        extraTests: `
pm.test('Request: customer cannot manage products', function () {
  pm.expect(json.error).to.eql('Forbidden');
});
`,
      }),
      req({
        name: 'CU list users (expect 403)',
        method: 'GET',
        url: '{{baseUrl}}/api/users',
        auth: bearer('CU_token'),
        status: 403,
      }),
      req({
        name: 'AD delete user (expect 403)',
        method: 'DELETE',
        url: '{{baseUrl}}/api/users/{{deleteUserId}}',
        auth: bearer('AD_token'),
        status: 403,
        extraTests: `
pm.test('Request: admin cannot delete users', function () {
  pm.expect(json.error).to.eql('Forbidden');
  pm.expect(json.message).to.match(/Super admin only/i);
});
`,
      }),
      req({
        name: 'Get missing user (expect 404)',
        method: 'GET',
        url: '{{baseUrl}}/api/users/usr_doesnotexist',
        status: 404,
        extraTests: `
pm.test('Request: not found envelope', function () {
  pm.expect(json.error).to.eql('Not Found');
});
`,
      }),
      req({
        name: 'Create product missing fields (expect 400)',
        method: 'POST',
        url: '{{baseUrl}}/api/products',
        status: 400,
        body: { name: 'Incomplete' },
      }),
      req({
        name: 'Create duplicate SKU (expect 409)',
        method: 'POST',
        url: '{{baseUrl}}/api/products',
        status: 409,
        body: {
          dealer_id: '{{dealerId}}',
          name: 'Duplicate SKU Product',
          sku: '{{createdSku}}',
          category: 'electronics',
          price: 41.1,
        },
        extraTests: `
pm.test('Request: conflict includes existing product', function () {
  pm.expect(json.error).to.eql('Conflict');
  pm.expect(json.reason).to.eql('sku');
  pm.expect(json.existing).to.be.an('object');
});
`,
      }),
      req({
        name: 'Duplicate product details (expect 409)',
        method: 'POST',
        url: '{{baseUrl}}/api/product-details',
        status: 409,
        body: {
          product_id: '{{createdProductId}}',
          description: 'already exists',
        },
      }),
      req({
        name: 'Transfer to same dealer (expect 400)',
        method: 'POST',
        url: '{{baseUrl}}/api/transfers',
        status: 400,
        body: {
          product_id: '{{createdProductId}}',
          to_dealer_id: '{{dealerId}}',
          quantity: 1,
        },
      }),
      req({
        name: 'Unknown route (expect 404)',
        method: 'GET',
        url: '{{baseUrl}}/api/does-not-exist',
        status: 404,
        extraTests: `
pm.test('Request: route not found', function () {
  pm.expect(json.message).to.eql('Route not found');
});
`,
      }),
    ],
  },
  {
    name: '14 Cleanup (SA destructive)',
    item: [
      req({
        name: 'Delete product details',
        method: 'DELETE',
        url: '{{baseUrl}}/api/product-details/{{createdProductDetailId}}',
        status: 200,
        schema: 'productDetailDeleted',
      }),
      req({
        name: 'Delete created payment',
        method: 'DELETE',
        url: '{{baseUrl}}/api/payments/{{createdPaymentId}}',
        status: 200,
        schema: 'paymentDeleted',
      }),
      req({
        name: 'Delete created order',
        method: 'DELETE',
        url: '{{baseUrl}}/api/orders/{{sellOrderId}}',
        status: 200,
        schema: 'orderDeleted',
      }),
      req({
        name: 'Delete created product',
        method: 'DELETE',
        url: '{{baseUrl}}/api/products/{{createdProductId}}',
        status: 200,
        schema: 'productDeleted',
      }),
      req({
        name: 'Force delete disposable dealer',
        method: 'DELETE',
        url: '{{baseUrl}}/api/dealers/{{deleteDealerId}}?force=true',
        status: 200,
        schema: 'dealerDeleted',
      }),
      req({
        name: 'Delete disposable user',
        method: 'DELETE',
        url: '{{baseUrl}}/api/users/{{deleteUserId}}',
        status: 200,
        schema: 'userDeleted',
        extraTests: `
pm.test('Request: deleted the disposable user', function () {
  pm.expect(json.user.id).to.eql(pm.environment.get('deleteUserId'));
});
`,
      }),
    ],
  },
];

const env = {
  id: 'commerce-api-complete-env',
  name: 'Local Commerce API',
  values: [
    { key: 'baseUrl', value: 'http://localhost:3002', type: 'default', enabled: true },
    { key: 'PRODUCT_PRICE_MIN', value: '1', type: 'default', enabled: true },
    { key: 'PRODUCT_PRICE_MAX', value: '100', type: 'default', enabled: true },
    { key: 'accessToken', value: '', type: 'secret', enabled: true },
    { key: 'seedRun', value: '', type: 'default', enabled: true },

    { key: 'CU_email', value: 'customer@commerce.local', type: 'default', enabled: true },
    { key: 'CU_password', value: 'Password@123', type: 'secret', enabled: true },
    { key: 'CU_token', value: '', type: 'secret', enabled: true },
    { key: 'CU_userId', value: '', type: 'default', enabled: true },
    { key: 'CU_role', value: 'customer', type: 'default', enabled: true },

    { key: 'DL_email', value: 'dealer@commerce.local', type: 'default', enabled: true },
    { key: 'DL_password', value: 'Password@123', type: 'secret', enabled: true },
    { key: 'DL_token', value: '', type: 'secret', enabled: true },
    { key: 'DL_userId', value: '', type: 'default', enabled: true },
    { key: 'DL_role', value: 'dealer', type: 'default', enabled: true },
    { key: 'DL_productId', value: '', type: 'default', enabled: true },
    { key: 'DL_dealerId', value: '', type: 'default', enabled: true },

    { key: 'AD_email', value: 'admin@commerce.local', type: 'default', enabled: true },
    { key: 'AD_password', value: 'Admin@123', type: 'secret', enabled: true },
    { key: 'AD_token', value: '', type: 'secret', enabled: true },
    { key: 'AD_userId', value: '', type: 'default', enabled: true },
    { key: 'AD_role', value: 'admin', type: 'default', enabled: true },
    { key: 'AD_customerId', value: '', type: 'default', enabled: true },
    { key: 'AD_dealerId', value: '', type: 'default', enabled: true },
    { key: 'AD_productId', value: '', type: 'default', enabled: true },

    { key: 'SA_email', value: 'superadmin@commerce.local', type: 'default', enabled: true },
    { key: 'SA_password', value: 'Super@123', type: 'secret', enabled: true },
    { key: 'SA_token', value: '', type: 'secret', enabled: true },
    { key: 'SA_userId', value: '', type: 'default', enabled: true },
    { key: 'SA_role', value: 'super_admin', type: 'default', enabled: true },
    { key: 'SA_targetId', value: '', type: 'default', enabled: true },

    { key: 'userId', value: '', type: 'default', enabled: true },
    { key: 'listedUserId', value: '', type: 'default', enabled: true },
    { key: 'dealerId', value: '', type: 'default', enabled: true },
    { key: 'dealerId2', value: '', type: 'default', enabled: true },
    { key: 'productId', value: '', type: 'default', enabled: true },
    { key: 'productDetailId', value: '', type: 'default', enabled: true },
    { key: 'paymentId', value: '', type: 'default', enabled: true },
    { key: 'orderId', value: '', type: 'default', enabled: true },
    { key: 'buyOrderId', value: '', type: 'default', enabled: true },
    { key: 'buyPaymentId', value: '', type: 'default', enabled: true },
    { key: 'sellOrderId', value: '', type: 'default', enabled: true },
    { key: 'pricedOrderId', value: '', type: 'default', enabled: true },
    { key: 'destinationProductId', value: '', type: 'default', enabled: true },

    { key: 'createdUserId', value: '', type: 'default', enabled: true },
    { key: 'createdUserEmail', value: '', type: 'default', enabled: true },
    { key: 'createdDealerId', value: '', type: 'default', enabled: true },
    { key: 'createdProductId', value: '', type: 'default', enabled: true },
    { key: 'createdProductDetailId', value: '', type: 'default', enabled: true },
    { key: 'createdSku', value: '', type: 'default', enabled: true },
    { key: 'createdPaymentId', value: '', type: 'default', enabled: true },
    { key: 'createdPurchaseId', value: '', type: 'default', enabled: true },
    { key: 'createdOrderId', value: '', type: 'default', enabled: true },
    { key: 'createdReturnId', value: '', type: 'default', enabled: true },
    { key: 'createdTransferId', value: '', type: 'default', enabled: true },
    { key: 'deleteUserId', value: '', type: 'default', enabled: true },
    { key: 'deleteDealerId', value: '', type: 'default', enabled: true },

    { key: 'uniqueTs', value: '', type: 'default', enabled: true },
    { key: 'uniqueSku', value: '', type: 'default', enabled: true },
    { key: 'uniqueEmail', value: '', type: 'default', enabled: true },
    { key: 'uniqueDealerCode', value: '', type: 'default', enabled: true },
    { key: 'uniqueDealerEmail', value: '', type: 'default', enabled: true },
  ],
  _postman_variable_scope: 'environment',
};

const outDir = __dirname;
fs.writeFileSync(
  path.join(outDir, 'commerce-api.postman_collection.json'),
  `${JSON.stringify(collection, null, 2)}\n`
);
fs.writeFileSync(
  path.join(outDir, 'commerce-api.postman_environment.json'),
  `${JSON.stringify(env, null, 2)}\n`
);

const requestCount = collection.item.reduce((sum, folder) => sum + folder.item.length, 0);
console.log(`Wrote collection with ${collection.item.length} folders and ${requestCount} requests`);
console.log(`Wrote environment with ${env.values.length} variables`);
