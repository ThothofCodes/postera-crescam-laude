// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Unit tests for auth middleware — protect, role guards, scope, authorize.

const jwt = require('jsonwebtoken');

// Mock User and AuditLog models before importing middleware
jest.mock('../../models/User', () => ({
  findById: jest.fn(),
}));
jest.mock('../../models/AuditLog', () => ({
  create: jest.fn(),
}));

const User = require('../../models/User');
const {
  protect, superAdminGuard, deptHeadGuard, staffGuard, staffReadScope, deptScope, authorize,
} = require('../../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Ensure middleware sees the same secret the tests use
beforeAll(() => { process.env.JWT_SECRET = JWT_SECRET; });
afterAll(() => { delete process.env.JWT_SECRET; });

function makeToken(payload) {
  return jwt.sign(
    {
      id: payload.id || 'user1', email: payload.email || 'test@example.com', role: payload.role || 'STAFF', ...payload,
    },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' },
  );
}

function mockReqRes(overrides = {}) {
  return {
    req: {
      headers: {},
      params: {},
      body: {},
      user: null,
      ...overrides,
    },
    res: {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
      setHeader() { return this; },
      clearCookie() { return this; },
    },
    next: jest.fn(),
  };
}

describe('protect — JWT verification middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockReset();
  });

  test('returns 401 when no Authorization header', async () => {
    const { req, res, next } = mockReqRes();
    await protect(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/no token/i);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 for malformed token', async () => {
    const { req, res, next } = mockReqRes({ headers: { authorization: 'Bearer invalid-token' } });
    await protect(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/invalid token/i);
  });

  test('returns 401 for expired token', async () => {
    const token = jwt.sign({ id: 'u1', email: 'x@x.com', role: 'STAFF' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '-1s' });
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${token}` } });
    await protect(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/expired/i);
  });

  test('returns 401 when user not found in DB', async () => {
    const token = makeToken({ id: 'missing-user' });
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${token}` } });
    await protect(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/no longer exists/i);
  });

  test('returns 401 when user is deactivated', async () => {
    const token = makeToken({ id: 'u2', email: 'active@test.com' });
    User.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: 'u2', email: 'active@test.com', isActive: false, role: 'STAFF',
      }),
    });
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${token}` } });
    await protect(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  test('returns 401 when email changed after token issued', async () => {
    const token = makeToken({ id: 'u3', email: 'old@test.com' });
    User.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: 'u3', email: 'new@test.com', isActive: true, role: 'STAFF',
      }),
    });
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${token}` } });
    await protect(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/no longer valid/i);
  });

  test('calls next() and attaches user for valid token', async () => {
    const userDoc = {
      _id: 'u4', email: 'ok@test.com', isActive: true, role: 'STAFF',
    };
    const token = makeToken({ id: 'u4', email: 'ok@test.com', role: 'STAFF' });
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(userDoc) });
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${token}` } });
    await protect(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBe(userDoc);
  });

  test('rejects alg:none tokens', async () => {
    const { req, res, next } = mockReqRes({ headers: { authorization: 'Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpZCI6InUxIiwiZW1haWwiOiJ4QHguY29tIiwicm9sZSI6IlNUQUZGIn0.' } });
    await protect(req, res, next);
    expect(res.statusCode).toBe(401);
  });
});

describe('superAdminGuard', () => {
  test('allows SUPER_ADMIN with correct email', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'SUPER_ADMIN', email: 'codeofthoth@outlook.com' };
    process.env.SUPER_ADMIN_EMAIL = 'codeofthoth@outlook.com';
    superAdminGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects SUPER_ADMIN with wrong email', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'SUPER_ADMIN', email: 'other@test.com' };
    superAdminGuard(req, res, next);
    expect(res.statusCode).toBe(403);
  });

  test('rejects non-SUPER_ADMIN roles', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'DEPT_HEAD_OWNER', email: 'codeofthoth@outlook.com' };
    superAdminGuard(req, res, next);
    expect(res.statusCode).toBe(403);
  });
});

describe('deptHeadGuard', () => {
  test('allows SUPER_ADMIN', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'SUPER_ADMIN' };
    deptHeadGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('allows DEPT_HEAD_OWNER', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'DEPT_HEAD_OWNER' };
    deptHeadGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects STAFF', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'STAFF' };
    deptHeadGuard(req, res, next);
    expect(res.statusCode).toBe(403);
  });

  test('rejects undefined user', () => {
    const { req, res, next } = mockReqRes();
    deptHeadGuard(req, res, next);
    expect(res.statusCode).toBe(403);
  });
});

describe('staffGuard', () => {
  test.each(['SUPER_ADMIN', 'DEPT_HEAD_OWNER', 'STAFF', 'admin', 'staff'])('allows role: %s', (role) => {
    const { req, res, next } = mockReqRes();
    req.user = { role };
    staffGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects client role', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'client' };
    staffGuard(req, res, next);
    expect(res.statusCode).toBe(403);
  });
});

describe('staffReadScope', () => {
  test('SUPER_ADMIN skips dept filter', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'SUPER_ADMIN', department: 'dept-1' };
    staffReadScope(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.deptFilter).toBeUndefined();
  });

  test('STAFF gets department-scoped filter', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'STAFF', department: { _id: 'dept-2' } };
    staffReadScope(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.deptFilter).toEqual({ department: 'dept-2' });
  });

  test('client role is rejected', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'client' };
    staffReadScope(req, res, next);
    expect(res.statusCode).toBe(403);
  });
});

describe('deptScope', () => {
  test('SUPER_ADMIN bypasses department check', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'SUPER_ADMIN' };
    req.params.deptSlug = 'anything';
    deptScope(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('allows access when slug matches user department', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'STAFF', departmentSlug: 'repair', department: 'dept-r' };
    req.params.deptSlug = 'repair';
    deptScope(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('denies access when slug does not match', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'STAFF', departmentSlug: 'repair' };
    req.params.deptSlug = 'cybersecurity';
    deptScope(req, res, next);
    expect(res.statusCode).toBe(403);
  });
});

describe('authorize', () => {
  test('allows specified roles', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'STAFF' };
    authorize('STAFF', 'admin')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects unspecified roles', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'client' };
    authorize('STAFF', 'admin')(req, res, next);
    expect(res.statusCode).toBe(403);
  });

  test('returns 401 when no user', () => {
    const { req, res, next } = mockReqRes();
    authorize('STAFF')(req, res, next);
    expect(res.statusCode).toBe(401);
  });
});
