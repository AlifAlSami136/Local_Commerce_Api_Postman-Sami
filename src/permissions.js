/**
 * Role hierarchy and permission helpers for commerce CRUD.
 *
 * CU customer  — buy / own data; no deletes; no product management
 * DL dealer    — full product CRUD, stock add/out (with price), sell, transfers
 * AD admin     — create/manage customers & dealers; manage inventory
 * SA super_admin — unrestricted access over every role/action
 */

const ROLE_RANK = {
  customer: 1,
  dealer: 2,
  admin: 3,
  super_admin: 4,
};

const ROLE_INITIAL = {
  customer: 'CU',
  dealer: 'DL',
  admin: 'AD',
  super_admin: 'SA',
};

function isSuperAdmin(user) {
  return user?.role === 'super_admin';
}

function isAdminOrAbove(user) {
  return ROLE_RANK[user?.role] >= ROLE_RANK.admin;
}

function isDealerOrAbove(user) {
  return ROLE_RANK[user?.role] >= ROLE_RANK.dealer;
}

function canDelete(user) {
  return isSuperAdmin(user);
}

function canDeleteProducts(user) {
  return isSuperAdmin(user) || user?.role === 'dealer' || user?.role === 'admin';
}

function canManageCustomers(user) {
  return isAdminOrAbove(user);
}

function canManageProducts(user) {
  return isAdminOrAbove(user) || user?.role === 'dealer';
}

function canManageDealers(user) {
  return isAdminOrAbove(user);
}

function canManageInventory(user) {
  return isAdminOrAbove(user) || user?.role === 'dealer';
}

function canAdjustStock(user) {
  return canManageInventory(user);
}

function canAssignRole(actor, targetRole) {
  if (isSuperAdmin(actor)) return true;
  if (actor?.role === 'admin') {
    return ['customer', 'dealer'].includes(targetRole);
  }
  return false;
}

function forbidden(message) {
  const error = new Error(message);
  error.status = 403;
  error.code = 'Forbidden';
  return error;
}

function buildPermissionMap(user) {
  const role = user?.role;
  return {
    role,
    initial: ROLE_INITIAL[role] || 'NA',
    read: true,
    create_customers: canManageCustomers(user),
    update_customers: canManageCustomers(user),
    create_dealers: canManageDealers(user),
    update_dealers: canManageDealers(user),
    delete_any: canDelete(user),
    delete_products: canDeleteProducts(user),
    manage_dealers: canManageDealers(user),
    manage_products: canManageProducts(user),
    manage_product_details: canManageProducts(user),
    manage_product_state: canManageProducts(user),
    manage_inventory: canManageInventory(user),
    manage_payments: role === 'customer' || isAdminOrAbove(user),
    stock_ops: canAdjustStock(user),
    stock_out_with_price: canAdjustStock(user),
    buy: role === 'customer' || isAdminOrAbove(user),
    sell: role === 'dealer' || isAdminOrAbove(user),
    transfers: role === 'dealer' || isAdminOrAbove(user),
    dashboard: true,
    bypass_blockers: isSuperAdmin(user),
  };
}

module.exports = {
  ROLE_RANK,
  ROLE_INITIAL,
  isSuperAdmin,
  isAdminOrAbove,
  isDealerOrAbove,
  canDelete,
  canDeleteProducts,
  canManageCustomers,
  canManageProducts,
  canManageDealers,
  canManageInventory,
  canAdjustStock,
  canAssignRole,
  buildPermissionMap,
  forbidden,
};
