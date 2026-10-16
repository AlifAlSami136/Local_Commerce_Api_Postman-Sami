const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('./config');
const { readCsv } = require('./csvStore');
const { isSuperAdmin, ROLE_RANK } = require('./permissions');

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: config.accessTokenTtl }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

function findUserByEmail(email) {
  return readCsv('users').find((user) => user.email.toLowerCase() === String(email).toLowerCase());
}

function findUserById(id) {
  return readCsv('users').find((user) => user.id === id);
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    city: user.city,
    created_at: user.created_at,
    seed_run: user.seed_run,
  };
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

/**
 * Auth middleware — attach req.user from Bearer token.
 */
function authHandler(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Use: Bearer <access_token>',
    });
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyAccessToken(token);
    const user = findUserById(payload.sub);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User linked to token no longer exists',
      });
    }

    req.user = toPublicUser(user);
    req.token = token;
    return next();
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token';

    return res.status(401).json({
      error: 'Unauthorized',
      message,
    });
  }
}

/**
 * Allow listed roles. Super admin always passes.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (isSuperAdmin(req.user)) {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires one of: ${[...roles, 'super_admin'].join(', ')}`,
      });
    }
    return next();
  };
}

/** Super admin only (destructive / unrestricted ops). */
function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }
  if (!isSuperAdmin(req.user)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Super admin only. Customers, dealers, and admins cannot perform this action.',
    });
  }
  return next();
}

/** Admin or super admin. */
function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}

function hasMinRole(user, minRole) {
  return (ROLE_RANK[user?.role] || 0) >= (ROLE_RANK[minRole] || 0);
}

module.exports = {
  createAccessToken,
  verifyAccessToken,
  authHandler,
  requireRole,
  requireSuperAdmin,
  requireAdmin,
  hasMinRole,
  findUserByEmail,
  findUserById,
  toPublicUser,
  verifyPassword,
};
