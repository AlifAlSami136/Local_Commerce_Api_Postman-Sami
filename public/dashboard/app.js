const ENTITY_ORDER = [
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

const ROLE_SECTIONS = [
  {
    key: 'customer',
    initial: 'CU',
    title: 'Customer',
    email: 'customer@commerce.local',
    password: 'Password@123',
    desc: 'Buy products, view own payments/orders. No deletes.',
  },
  {
    key: 'dealer',
    initial: 'DL',
    title: 'Dealer',
    email: 'dealer@commerce.local',
    password: 'Password@123',
    desc: 'Full product CRUD, stock add/out with price, sell & transfer.',
  },
  {
    key: 'admin',
    initial: 'AD',
    title: 'Admin',
    email: 'admin@commerce.local',
    password: 'Admin@123',
    desc: 'Create customers & dealers. Manage inventory and product state.',
  },
  {
    key: 'super_admin',
    initial: 'SA',
    title: 'Super Admin',
    email: 'superadmin@commerce.local',
    password: 'Super@123',
    desc: 'Unrestricted access across every role and destructive action.',
  },
];

function productDefaults() {
  const cfg = state.productConfig;
  const priceMin = cfg?.price_min ?? 1;
  const priceMax = cfg?.price_max ?? 100;
  const mid = Number((((priceMin + priceMax) / 2)).toFixed(2));
  return {
    name: 'Sample Product',
    skuPrefix: 'SKU',
    category: 'electronics',
    price: mid,
    stock: 25,
    priceMin,
    priceMax,
    priceStep: cfg?.price_step ?? 0.01,
  };
}

function buildActions(permissions, sectionKey) {
  const d = productDefaults();
  const priceField = (name, label, required = false, value) => ({
    name,
    label: `${label} (${d.priceMin}-${d.priceMax})`,
    type: 'number',
    step: String(d.priceStep),
    min: String(d.priceMin),
    max: String(d.priceMax),
    required,
    value: value == null ? '' : String(value),
  });

  const all = [
    {
      id: 'buy',
      sections: ['customer', 'admin', 'super_admin'],
      need: 'buy',
      label: 'Buy',
      entity: 'orders',
      hint: 'Customer purchase flow.',
      fields: [
        { name: 'product_id', label: 'Product', type: 'product', required: true },
        { name: 'quantity', label: 'Qty', type: 'number', value: '1', required: true },
        { name: 'method', label: 'Method', type: 'select', options: ['card', 'wallet', 'upi', 'bank_transfer'], value: 'card' },
      ],
      submitLabel: 'Buy',
      run: (body) => api('/api/buy', { method: 'POST', body: JSON.stringify(body) }),
    },
    {
      id: 'payment_create',
      sections: ['customer', 'admin', 'super_admin'],
      need: 'manage_payments',
      label: 'Create payment',
      entity: 'payments',
      hint: 'Create a payment record.',
      fields: [
        { name: 'amount', label: 'Amount', type: 'number', value: '50', required: true },
        { name: 'method', label: 'Method', type: 'select', options: ['card', 'wallet', 'upi', 'bank_transfer'], value: 'card' },
        { name: 'status', label: 'Status', type: 'select', options: ['pending', 'authorized', 'captured'], value: 'pending' },
        { name: 'user_id', label: 'User (admin/SA)', type: 'user' },
      ],
      submitLabel: 'Create payment',
      run: (body) => {
        if (!body.user_id) delete body.user_id;
        return api('/api/payments', { method: 'POST', body: JSON.stringify(body) });
      },
    },
    {
      id: 'return',
      sections: ['customer', 'admin', 'super_admin'],
      need: 'buy',
      label: 'Return',
      entity: 'returns',
      hint: 'Return an order and restore stock.',
      fields: [
        { name: 'order_id', label: 'Order', type: 'order', required: true },
        { name: 'quantity', label: 'Qty', type: 'number', value: '1' },
        { name: 'reason', label: 'Reason', type: 'select', options: ['damaged', 'wrong_item', 'customer_change_mind', 'defective'], value: 'customer_change_mind' },
      ],
      submitLabel: 'Return',
      run: (body) => api('/api/returns', { method: 'POST', body: JSON.stringify(body) }),
    },
    {
      id: 'product_create',
      sections: ['dealer', 'admin', 'super_admin'],
      need: 'manage_products',
      label: 'Add product',
      entity: 'products',
      hint: `Create product. Price must be float ${d.priceMin}-${d.priceMax}. Duplicate name+category+price for same dealer (or duplicate SKU) is blocked.`,
      fields: [
        { name: 'dealer_id', label: 'Dealer', type: 'dealer', required: true },
        { name: 'name', label: 'Name', required: true, value: d.name },
        {
          name: 'sku',
          label: 'SKU (unique)',
          required: true,
          value: () => `${d.skuPrefix}-${Date.now().toString().slice(-6)}`,
        },
        {
          name: 'category',
          label: 'Category',
          type: 'select',
          options: ['electronics', 'accessories', 'home', 'office', 'wearables'],
          value: d.category,
        },
        priceField('price', 'Price', true, d.price),
        { name: 'stock', label: 'Stock', type: 'number', value: String(d.stock) },
      ],
      submitLabel: 'Create product',
      run: (body) => api('/api/products', { method: 'POST', body: JSON.stringify(body) }),
    },
    {
      id: 'product_update',
      sections: ['dealer', 'admin', 'super_admin'],
      need: 'manage_products',
      label: 'Edit product',
      entity: 'products',
      hint: 'Update product fields. Price remains float within configured min/max.',
      fields: [
        { name: 'id', label: 'Product', type: 'product', required: true },
        { name: 'name', label: 'Name' },
        priceField('price', 'Price'),
        {
          name: 'category',
          label: 'Category',
          type: 'select',
          options: ['', 'electronics', 'accessories', 'home', 'office', 'wearables'],
          value: '',
        },
        { name: 'sku', label: 'SKU' },
      ],
      submitLabel: 'Update product',
      run: (body) => putById('/api/products', body),
    },
    {
      id: 'product_state',
      sections: ['dealer', 'admin', 'super_admin'],
      need: 'manage_product_state',
      label: 'Product state',
      entity: 'products',
      hint: 'Set status and/or stock.',
      fields: [
        { name: 'id', label: 'Product', type: 'product', required: true },
        { name: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'discontinued', 'out_of_stock'], value: 'active' },
        { name: 'stock', label: 'Stock', type: 'number', value: '40' },
      ],
      submitLabel: 'Update state',
      run: (body) => {
        const id = body.id;
        const payload = {};
        if (body.status) payload.status = body.status;
        if (body.stock !== '') payload.stock = Number(body.stock);
        return api(`/api/products/${encodeURIComponent(id)}/state`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      },
    },
    {
      id: 'product_details',
      sections: ['dealer', 'admin', 'super_admin'],
      need: 'manage_product_details',
      label: 'Edit details',
      entity: 'product_details',
      hint: 'Update product detail record.',
      fields: [
        { name: 'id', label: 'Detail', type: 'product_detail', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'color', label: 'Color' },
        { name: 'warranty_months', label: 'Warranty months', type: 'number' },
      ],
      submitLabel: 'Update details',
      run: (body) => putById('/api/product-details', body),
    },
    {
      id: 'stock_add',
      sections: ['dealer', 'admin', 'super_admin'],
      need: 'stock_ops',
      label: 'Stock add',
      entity: 'stock_movements',
      hint: 'Increase inventory.',
      fields: [
        { name: 'product_id', label: 'Product', type: 'product', required: true },
        { name: 'quantity', label: 'Qty', type: 'number', value: '10', required: true },
        { name: 'reason', label: 'Reason', value: 'restock' },
      ],
      submitLabel: 'Add stock',
      run: (body) => api('/api/stock/add', { method: 'POST', body: JSON.stringify(body) }),
    },
    {
      id: 'stock_out_price',
      sections: ['dealer', 'admin', 'super_admin'],
      need: 'stock_out_with_price',
      label: 'Stock out + price',
      entity: 'stock_movements',
      hint: 'Stock out and optionally set selling price (creates priced sell order).',
      fields: [
        { name: 'product_id', label: 'Product', type: 'product', required: true },
        { name: 'quantity', label: 'Qty', type: 'number', value: '1', required: true },
        priceField('unit_price', 'Unit price', true, d.price),
        { name: 'reason', label: 'Reason', value: 'dealer_stock_out' },
      ],
      submitLabel: 'Stock out with price',
      run: (body) => api('/api/stock/out', { method: 'POST', body: JSON.stringify(body) }),
    },
    {
      id: 'sell',
      sections: ['dealer', 'admin', 'super_admin'],
      need: 'sell',
      label: 'Sell',
      entity: 'orders',
      hint: 'Dealer sell flow.',
      fields: [
        { name: 'product_id', label: 'Product', type: 'product', required: true },
        { name: 'quantity', label: 'Qty', type: 'number', value: '1', required: true },
        priceField('unit_price', 'Unit price (optional)'),
        { name: 'buyer_name', label: 'Buyer', value: 'walk-in' },
      ],
      submitLabel: 'Sell',
      run: (body) => {
        if (body.unit_price === '') delete body.unit_price;
        return api('/api/sell', { method: 'POST', body: JSON.stringify(body) });
      },
    },
    {
      id: 'transfer',
      sections: ['dealer', 'admin', 'super_admin'],
      need: 'transfers',
      label: 'Transfer',
      entity: 'transfers',
      hint: 'Move stock to another dealer.',
      fields: [
        { name: 'product_id', label: 'Product', type: 'product', required: true },
        { name: 'to_dealer_id', label: 'To dealer', type: 'dealer', required: true },
        { name: 'quantity', label: 'Qty', type: 'number', value: '1', required: true },
      ],
      submitLabel: 'Transfer',
      run: (body) => api('/api/transfers', { method: 'POST', body: JSON.stringify(body) }),
    },
    {
      id: 'product_delete',
      sections: ['dealer', 'admin', 'super_admin'],
      need: 'delete_products',
      label: 'Delete product',
      entity: 'products',
      danger: true,
      hint: 'Dealer/Admin/SA can delete products.',
      fields: [{ name: 'id', label: 'Product', type: 'product', required: true }],
      submitLabel: 'Delete product',
      run: (body) => api(`/api/products/${encodeURIComponent(body.id)}`, { method: 'DELETE' }),
    },
    {
      id: 'customer_create',
      sections: ['admin', 'super_admin'],
      need: 'create_customers',
      label: 'Create customer',
      entity: 'users',
      hint: 'Admin creates customer (or dealer). SA can create any role.',
      fields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'password', label: 'Password', value: 'Password@123', required: true },
        { name: 'first_name', label: 'First name', required: true },
        { name: 'last_name', label: 'Last name', required: true },
        {
          name: 'role',
          label: 'Role',
          type: 'select',
          options: sectionKey === 'super_admin' ? ['customer', 'dealer', 'admin', 'super_admin'] : ['customer', 'dealer'],
          value: 'customer',
        },
        { name: 'city', label: 'City', value: 'Dhaka' },
      ],
      submitLabel: 'Create user',
      run: (body) => api('/api/users', { method: 'POST', body: JSON.stringify(body) }),
    },
    {
      id: 'customer_update',
      sections: ['admin', 'super_admin'],
      need: 'update_customers',
      label: 'Edit customer',
      entity: 'users',
      hint: 'Update customer/user details.',
      fields: [
        { name: 'id', label: 'User', type: 'user', required: true },
        { name: 'first_name', label: 'First name' },
        { name: 'last_name', label: 'Last name' },
        { name: 'city', label: 'City' },
        { name: 'email', label: 'Email', type: 'email' },
      ],
      submitLabel: 'Update user',
      run: (body) => putById('/api/users', body),
    },
    {
      id: 'dealer_create',
      sections: ['admin', 'super_admin'],
      need: 'create_dealers',
      label: 'Create dealer',
      entity: 'dealers',
      hint: 'Admin/SA create dealer organization.',
      fields: [
        { name: 'name', label: 'Name', required: true },
        { name: 'code', label: 'Code', required: true, value: () => `DLR-${Date.now().toString().slice(-5)}` },
        { name: 'region', label: 'Region', value: 'Dhaka', required: true },
        { name: 'contact_email', label: 'Contact email', type: 'email', required: true },
      ],
      submitLabel: 'Create dealer',
      run: (body) => api('/api/dealers', { method: 'POST', body: JSON.stringify(body) }),
    },
    {
      id: 'dealer_update',
      sections: ['admin', 'super_admin'],
      need: 'update_dealers',
      label: 'Edit dealer',
      entity: 'dealers',
      hint: 'Update dealer details.',
      fields: [
        { name: 'id', label: 'Dealer', type: 'dealer', required: true },
        { name: 'name', label: 'Name' },
        { name: 'region', label: 'Region' },
        { name: 'status', label: 'Status', type: 'select', options: ['', 'active', 'inactive'], value: '' },
        { name: 'contact_email', label: 'Contact email', type: 'email' },
      ],
      submitLabel: 'Update dealer',
      run: (body) => putById('/api/dealers', body),
    },
    {
      id: 'inventory_adjust',
      sections: ['admin', 'super_admin'],
      need: 'manage_inventory',
      label: 'Inventory adjust',
      entity: 'stock_movements',
      hint: 'Set absolute stock quantity (admin inventory control).',
      fields: [
        { name: 'product_id', label: 'Product', type: 'product', required: true },
        { name: 'new_quantity', label: 'New quantity', type: 'number', value: '100', required: true },
        { name: 'reason', label: 'Reason', value: 'admin_inventory_adjust' },
      ],
      submitLabel: 'Adjust inventory',
      run: (body) => api('/api/stock/adjust', { method: 'POST', body: JSON.stringify(body) }),
    },
    {
      id: 'force_delete',
      sections: ['super_admin'],
      need: 'delete_any',
      label: 'Force delete',
      entity: null,
      danger: true,
      hint: 'SA only. Force cascade for dealers with ?force=true.',
      fields: [
        { name: 'entity', label: 'Entity', type: 'select', options: ['users', 'dealers', 'products', 'product_details', 'payments', 'orders'], value: 'products', required: true },
        { name: 'id', label: 'ID', required: true },
        { name: 'force', label: 'Force cascade', type: 'select', options: ['false', 'true'], value: 'true' },
      ],
      submitLabel: 'Delete',
      run: (body) => {
        const q = body.force === 'true' ? '?force=true' : '';
        return api(`/api/${body.entity}/${encodeURIComponent(body.id)}${q}`, { method: 'DELETE' });
      },
    },
  ];

  return all.filter(
    (action) =>
      action.sections.includes(sectionKey) && (!action.need || permissions?.[action.need])
  );
}

function putById(basePath, body) {
  const id = body.id;
  const payload = { ...body };
  delete payload.id;
  Object.keys(payload).forEach((key) => {
    if (payload[key] === '') delete payload[key];
  });
  return api(`${basePath}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

const state = {
  section: localStorage.getItem('commerceActiveSection') || 'super_admin',
  sessions: JSON.parse(localStorage.getItem('commerceRoleSessions') || '{}'),
  permissions: null,
  productConfig: null,
  actions: [],
  actionId: null,
  snapshot: null,
  entity: 'products',
  origin: 'all',
  query: '',
  highlightId: null,
  autoRefreshTimer: null,
};

const els = {
  apiStatus: document.getElementById('apiStatus'),
  roleNav: document.getElementById('roleNav'),
  activeSession: document.getElementById('activeSession'),
  activeRoleValue: document.getElementById('activeRoleValue'),
  seedRunValue: document.getElementById('seedRunValue'),
  countsPair: document.getElementById('countsPair'),
  refreshedAt: document.getElementById('refreshedAt'),
  sectionTitle: document.getElementById('sectionTitle'),
  sectionMeta: document.getElementById('sectionMeta'),
  roleLoginForm: document.getElementById('roleLoginForm'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  connectBtn: document.getElementById('connectBtn'),
  disconnectBtn: document.getElementById('disconnectBtn'),
  actionTabs: document.getElementById('actionTabs'),
  actionForm: document.getElementById('actionForm'),
  activityLog: document.getElementById('activityLog'),
  clearActivity: document.getElementById('clearActivity'),
  autoRefresh: document.getElementById('autoRefresh'),
  entityTabs: document.getElementById('entityTabs'),
  entityTitle: document.getElementById('entityTitle'),
  entityMeta: document.getElementById('entityMeta'),
  searchInput: document.getElementById('searchInput'),
  refreshBtn: document.getElementById('refreshBtn'),
  dataTable: document.getElementById('dataTable'),
  emptyState: document.getElementById('emptyState'),
  countsGrid: document.getElementById('countsGrid'),
  toast: document.getElementById('toast'),
};

function currentSection() {
  return ROLE_SECTIONS.find((s) => s.key === state.section) || ROLE_SECTIONS[3];
}

function currentToken() {
  return state.sessions[state.section]?.token || '';
}

function currentUser() {
  return state.sessions[state.section]?.user || null;
}

function persistSessions() {
  localStorage.setItem('commerceRoleSessions', JSON.stringify(state.sessions));
  localStorage.setItem('commerceActiveSection', state.section);
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => els.toast.classList.add('hidden'), 2600);
}

function logActivity(title, payload) {
  const stamp = new Date().toLocaleTimeString();
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  const initial = currentSection().initial;
  els.activityLog.textContent = `[${stamp}] [${initial}] ${title}\n${body}\n\n` + els.activityLog.textContent;
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = currentToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

function setApiStatus(ok, label) {
  els.apiStatus.textContent = label;
  els.apiStatus.classList.toggle('ok', ok);
  els.apiStatus.classList.toggle('err', !ok);
}

function isCreated(row) {
  return String(row.seed_run || '') === 'runtime';
}

function allRows(entityKey) {
  const bucket = state.snapshot?.entities?.[entityKey];
  if (!bucket) return [];
  return [...bucket.seeded, ...bucket.created];
}

function visibleRows(entityKey) {
  const bucket = state.snapshot?.entities?.[entityKey];
  if (!bucket) return [];
  let rows =
    state.origin === 'seeded'
      ? bucket.seeded
      : state.origin === 'created'
        ? bucket.created
        : [...bucket.seeded, ...bucket.created];
  const q = state.query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(q))
  );
}

function fieldValue(field) {
  return typeof field.value === 'function' ? field.value() : field.value ?? '';
}

function optionList(type) {
  if (type === 'dealer') {
    return allRows('dealers').map((row) => ({ value: row.id, label: `${row.name} (${row.id})` }));
  }
  if (type === 'product') {
    return allRows('products').map((row) => ({
      value: row.id,
      label: `${row.name} · $${row.price} · stock ${row.stock} (${row.id})`,
    }));
  }
  if (type === 'product_detail') {
    return allRows('product_details').map((row) => ({
      value: row.id,
      label: `${row.product_id} (${row.id})`,
    }));
  }
  if (type === 'user') {
    return allRows('users').map((row) => ({ value: row.id, label: `${row.email} (${row.role})` }));
  }
  if (type === 'order') {
    return allRows('orders').map((row) => ({ value: row.id, label: `${row.type} · ${row.reference || row.id}` }));
  }
  return [];
}

function currentAction() {
  return state.actions.find((a) => a.id === state.actionId) || state.actions[0];
}

function renderRoleNav() {
  els.roleNav.innerHTML = '';
  for (const section of ROLE_SECTIONS) {
    const connected = Boolean(state.sessions[section.key]?.token);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `role-card${state.section === section.key ? ' active' : ''}`;
    button.innerHTML = `
      <div class="initial">${section.initial}</div>
      <strong>${section.title}</strong>
      <p class="role-desc">${section.desc}</p>
      <div class="role-status">${connected ? 'Connected' : 'Not connected'}</div>
    `;
    button.addEventListener('click', () => switchSection(section.key));
    els.roleNav.appendChild(button);
  }
}

function fillLoginDefaults() {
  const section = currentSection();
  els.email.value = section.email;
  els.password.value = section.password;
  els.sectionTitle.textContent = `${section.initial} · ${section.title}`;
  els.sectionMeta.textContent = section.desc;
  els.activeRoleValue.textContent = `${section.initial} (${section.key})`;
}

function renderSession() {
  const user = currentUser();
  const section = currentSection();
  if (user) {
    els.activeSession.innerHTML = `${section.initial} connected as <strong>${user.email}</strong> <span class="badge created">${user.role}</span>`;
  } else {
    els.activeSession.textContent = `${section.initial} section ready — connect to run actions.`;
  }
}

function renderActionTabs() {
  els.actionTabs.innerHTML = '';
  if (!currentToken()) {
    els.actionTabs.innerHTML = '<p class="meta">Connect this role to unlock actions.</p>';
    els.actionForm.innerHTML = '';
    return;
  }
  if (!state.actions.length) {
    els.actionTabs.innerHTML = '<p class="meta">No actions for this role.</p>';
    els.actionForm.innerHTML = '';
    return;
  }
  for (const action of state.actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.classList.toggle('active', action.id === state.actionId);
    button.addEventListener('click', () => {
      state.actionId = action.id;
      renderActionTabs();
      renderActionForm();
    });
    els.actionTabs.appendChild(button);
  }
}

function renderActionForm() {
  const action = currentAction();
  els.actionForm.innerHTML = '';
  if (!action) return;
  els.actionForm.onsubmit = onActionSubmit;

  const hint = document.createElement('p');
  hint.className = 'hint full';
  hint.textContent = action.hint;
  els.actionForm.appendChild(hint);

  for (const field of action.fields) {
    const label = document.createElement('label');
    if (field.type === 'textarea') label.classList.add('full');
    const span = document.createElement('span');
    span.textContent = field.label;
    label.appendChild(span);

    let input;
    const selectTypes = ['select', 'dealer', 'product', 'product_detail', 'user', 'order'];
    if (selectTypes.includes(field.type)) {
      input = document.createElement('select');
      input.name = field.name;
      input.required = Boolean(field.required);
      const options =
        field.type === 'select'
          ? field.options.map((opt) => ({ value: opt, label: opt || '(unchanged)' }))
          : optionList(field.type);
      if (!options.length) {
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = 'No options yet';
        input.appendChild(empty);
      } else {
        options.forEach((opt) => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          input.appendChild(option);
        });
      }
      const preferred = fieldValue(field);
      if (preferred !== undefined) input.value = preferred;
    } else {
      input = document.createElement(field.type === 'textarea' ? 'textarea' : 'input');
      input.name = field.name;
      input.required = Boolean(field.required);
      if (field.type && field.type !== 'textarea') input.type = field.type;
      if (field.step != null) input.step = field.step;
      if (field.min != null) input.min = field.min;
      if (field.max != null) input.max = field.max;
      if (field.type === 'number') {
        input.inputMode = 'decimal';
        if (!field.step) input.step = 'any';
      }
      input.value = fieldValue(field);
    }
    label.appendChild(input);
    els.actionForm.appendChild(label);
  }

  const row = document.createElement('div');
  row.className = 'actions-row full';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = action.submitLabel;
  if (action.danger) submit.classList.add('danger');
  row.appendChild(submit);
  els.actionForm.appendChild(row);
}

function renderSummary() {
  if (!state.snapshot) {
    els.seedRunValue.textContent = '—';
    els.countsPair.textContent = '0 / 0';
    els.refreshedAt.textContent = '—';
    return;
  }
  let seeded = 0;
  let created = 0;
  for (const key of ENTITY_ORDER) {
    const entity = state.snapshot.entities[key];
    if (!entity) continue;
    seeded += entity.seeded.length;
    created += entity.created.length;
  }
  els.seedRunValue.textContent = state.snapshot.seed_run || '—';
  els.countsPair.textContent = `${seeded} / ${created}`;
  els.refreshedAt.textContent = new Date(state.snapshot.generated_at).toLocaleString();
}

function renderTabs() {
  els.entityTabs.innerHTML = '';
  for (const key of ENTITY_ORDER) {
    const entity = state.snapshot?.entities?.[key];
    const total = entity ? entity.seeded.length + entity.created.length : 0;
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.toggle('active', state.entity === key);
    button.innerHTML = `${key.replaceAll('_', ' ')}<span class="count">${total}</span>`;
    button.addEventListener('click', () => {
      state.entity = key;
      render();
    });
    els.entityTabs.appendChild(button);
  }
}

function renderCounts() {
  els.countsGrid.innerHTML = '';
  if (!state.snapshot) return;
  for (const key of ENTITY_ORDER) {
    const entity = state.snapshot.entities[key];
    if (!entity) continue;
    const card = document.createElement('article');
    card.className = 'count-card';
    card.innerHTML = `
      <h3>${key.replaceAll('_', ' ')}</h3>
      <div class="pair"><span>Seeded</span><b>${entity.seeded.length}</b></div>
      <div class="pair"><span>Created</span><b>${entity.created.length}</b></div>
    `;
    els.countsGrid.appendChild(card);
  }
}

function renderTable() {
  const thead = els.dataTable.querySelector('thead');
  const tbody = els.dataTable.querySelector('tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';
  const bucket = state.snapshot?.entities?.[state.entity];
  if (!bucket) {
    els.entityTitle.textContent = state.entity;
    els.entityMeta.textContent = 'Connect a role to load data.';
    els.emptyState.classList.remove('hidden');
    return;
  }

  const rows = visibleRows(state.entity);
  const canDeleteProducts =
    state.entity === 'products' && state.permissions?.delete_products;
  const canForceDelete =
    ['users', 'dealers', 'payments', 'orders', 'product_details'].includes(state.entity) &&
    state.permissions?.delete_any;
  const showActions = canDeleteProducts || canForceDelete;
  const columns = [
    '_origin',
    ...bucket.columns.filter((col) => col !== 'password' && col !== 'password_hash'),
  ];
  if (showActions) columns.push('_actions');

  els.entityTitle.textContent = state.entity.replaceAll('_', ' ');
  els.entityMeta.textContent = `${rows.length} visible · ${bucket.seeded.length} seeded · ${bucket.created.length} created`;

  const headRow = document.createElement('tr');
  columns.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col === '_origin' ? 'origin' : col === '_actions' ? 'actions' : col;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  if (!rows.length) {
    els.emptyState.classList.remove('hidden');
    return;
  }
  els.emptyState.classList.add('hidden');

  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    const created = isCreated(row);
    tr.className = created ? 'created-row' : 'seeded-row';
    if (state.highlightId && row.id === state.highlightId) tr.classList.add('flash-row');
    tr.style.animationDelay = `${Math.min(index, 12) * 20}ms`;
    columns.forEach((col) => {
      const td = document.createElement('td');
      if (col === '_origin') {
        td.innerHTML = created
          ? '<span class="badge created">created</span>'
          : '<span class="badge seeded">seeded</span>';
      } else if (col === '_actions') {
        const wrap = document.createElement('div');
        wrap.className = 'row-actions';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Delete';
        button.addEventListener('click', () => deleteRow(state.entity, row.id));
        wrap.appendChild(button);
        td.appendChild(wrap);
      } else {
        td.textContent = row[col] == null || row[col] === '' ? '—' : String(row[col]);
        td.title = td.textContent;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

async function deleteRow(entity, id) {
  if (!confirm(`Delete ${entity} ${id}?`)) return;
  try {
    const force = entity === 'dealers' ? '?force=true' : '';
    const result = await api(`/api/${entity}/${encodeURIComponent(id)}${force}`, { method: 'DELETE' });
    logActivity(`DELETE ${entity}/${id}`, result);
    await loadSnapshot({ quiet: true });
    toast('Deleted');
  } catch (error) {
    logActivity('DELETE failed', error.payload || error.message);
    toast(error.message);
  }
}

function render() {
  renderRoleNav();
  fillLoginDefaults();
  renderSession();
  renderSummary();
  renderTabs();
  renderCounts();
  renderTable();
  renderActionTabs();
  renderActionForm();
}

async function checkHealth() {
  try {
    const health = await api('/health');
    setApiStatus(true, `API ok · run ${health.seed_run || 'n/a'}`);
  } catch {
    setApiStatus(false, 'API offline');
  }
}

async function loadProductConfig() {
  try {
    state.productConfig = await api('/api/meta/products');
  } catch {
    state.productConfig = {
      price_min: 1,
      price_max: 100,
      price_step: 0.01,
    };
  }
}

async function loadSnapshot({ quiet = false } = {}) {
  if (!currentToken()) {
    state.snapshot = null;
    state.permissions = null;
    state.actions = [];
    render();
    return;
  }
  await loadProductConfig();
  const permPayload = await api('/api/auth/permissions');
  state.permissions = permPayload.permissions;
  state.actions = buildActions(state.permissions, state.section);
  if (!state.actions.find((a) => a.id === state.actionId)) {
    state.actionId = state.actions[0]?.id || null;
  }
  state.snapshot = await api('/api/dashboard/snapshot');
  render();
  if (!quiet) toast(`${currentSection().initial} data refreshed`);
}

async function switchSection(key) {
  state.section = key;
  state.actionId = null;
  persistSessions();
  fillLoginDefaults();
  try {
    await loadSnapshot({ quiet: true });
  } catch {
    state.snapshot = null;
    state.permissions = null;
    state.actions = [];
    render();
  }
}

async function onLogin(event) {
  event.preventDefault();
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: els.email.value.trim(),
        password: els.password.value,
      }),
    });
    if (data.user.role !== state.section && state.section !== 'super_admin') {
      // Allow SA credentials only in SA section; other sections expect matching role
      if (data.user.role !== state.section) {
        toast(`This section expects role ${state.section}. Got ${data.user.role}.`);
      }
    }
    if (data.user.role !== state.section) {
      // Still allow connect but switch section to matched role for clarity
      state.section = data.user.role;
    }
    state.sessions[state.section] = { token: data.access_token, user: data.user };
    persistSessions();
    await loadSnapshot();
    toast(`${currentSection().initial} connected`);
  } catch (error) {
    toast(error.message);
  }
}

function onDisconnect() {
  delete state.sessions[state.section];
  persistSessions();
  state.snapshot = null;
  state.permissions = null;
  state.actions = [];
  render();
  toast(`${currentSection().initial} disconnected`);
}

async function onActionSubmit(event) {
  event.preventDefault();
  const action = currentAction();
  if (!action) return;
  const formData = new FormData(els.actionForm);
  const body = {};
  for (const [key, value] of formData.entries()) {
    body[key] = typeof value === 'string' ? value.trim() : value;
  }
  try {
    const result = await action.run(body);
    state.highlightId =
      result?.id ||
      result?.user?.id ||
      result?.product?.id ||
      result?.dealer?.id ||
      result?.payment?.id ||
      result?.order?.id ||
      result?.movement?.id ||
      body.id ||
      null;
    logActivity(`${action.submitLabel} OK`, result);
    if (action.entity) {
      state.entity = action.entity;
      state.origin = action.id.includes('delete') ? 'all' : 'created';
      document.querySelectorAll('.seg').forEach((el) => {
        el.classList.toggle('active', el.dataset.origin === state.origin);
      });
    }
    await loadSnapshot({ quiet: true });
    toast(`${action.label} done`);
    renderActionForm();
  } catch (error) {
    logActivity(`${action.submitLabel} failed`, error.payload || { message: error.message });
    toast(error.message);
  }
}

document.querySelectorAll('.seg').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.seg').forEach((el) => el.classList.remove('active'));
    button.classList.add('active');
    state.origin = button.dataset.origin;
    renderTable();
  });
});

els.roleLoginForm.addEventListener('submit', onLogin);
els.disconnectBtn.addEventListener('click', onDisconnect);
els.refreshBtn.addEventListener('click', async () => {
  try {
    await checkHealth();
    await loadSnapshot();
  } catch (error) {
    toast(error.message);
  }
});
els.searchInput.addEventListener('input', (event) => {
  state.query = event.target.value;
  renderTable();
});
els.clearActivity.addEventListener('click', () => {
  els.activityLog.textContent = 'Activity cleared.';
});
els.autoRefresh.addEventListener('change', () => {
  if (els.autoRefresh.checked) {
    state.autoRefreshTimer = setInterval(async () => {
      try {
        await checkHealth();
        if (currentToken()) await loadSnapshot({ quiet: true });
      } catch (error) {
        toast(error.message);
      }
    }, 5000);
    toast('Auto-refresh on');
  } else if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
    toast('Auto-refresh off');
  }
});

checkHealth();
loadProductConfig().then(() => switchSection(state.section));
