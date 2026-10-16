const config = require('./config');
const { readCsv } = require('./csvStore');

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeSku(sku) {
  return String(sku || '')
    .trim()
    .toUpperCase();
}

/**
 * Parse and validate a commerce price as float within configured bounds.
 * Returns a number with up to 2 decimal places.
 */
function parsePrice(value, fieldName = 'price') {
  if (value === undefined || value === null || value === '') {
    const error = new Error(`${fieldName} is required`);
    error.status = 400;
    throw error;
  }

  const parsed = typeof value === 'number' ? value : Number(String(value).trim());

  if (!Number.isFinite(parsed)) {
    const error = new Error(`${fieldName} must be a valid float number (example: 29.99)`);
    error.status = 400;
    throw error;
  }

  const rounded = Number(parsed.toFixed(2));
  const min = config.product.priceMin;
  const max = config.product.priceMax;

  if (rounded < min || rounded > max) {
    const error = new Error(`${fieldName} must be between ${min} and ${max} (got ${rounded})`);
    error.status = 400;
    throw error;
  }

  return rounded;
}

function pricesEqual(a, b) {
  return Number(Number(a).toFixed(2)) === Number(Number(b).toFixed(2));
}

/**
 * Block duplicate products: same SKU globally, or same dealer + name + price + category.
 */
function findDuplicateProduct({ dealerId, name, sku, category, price, excludeId = null }) {
  const products = readCsv('products');
  const normalizedSku = normalizeSku(sku);
  const normalizedName = normalizeName(name);
  const normalizedCategory = String(category || '')
    .trim()
    .toLowerCase();

  for (const row of products) {
    if (excludeId && row.id === excludeId) continue;

    if (normalizeSku(row.sku) === normalizedSku) {
      return {
        reason: 'sku',
        message: `SKU '${sku}' already exists on product ${row.id}`,
        existing: row,
      };
    }

    const sameDealer = row.dealer_id === dealerId;
    const sameName = normalizeName(row.name) === normalizedName;
    const sameCategory =
      normalizeName(row.category) === normalizedCategory ||
      String(row.category || '').trim().toLowerCase() === normalizedCategory;
    const samePrice = pricesEqual(row.price, price);

    if (sameDealer && sameName && sameCategory && samePrice) {
      return {
        reason: 'details',
        message: `Duplicate product for this dealer with same name, category, and price (${price}). Existing id: ${row.id}`,
        existing: row,
      };
    }
  }

  return null;
}

module.exports = {
  parsePrice,
  pricesEqual,
  findDuplicateProduct,
  normalizeName,
  normalizeSku,
};
