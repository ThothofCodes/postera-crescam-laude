// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const router = require('express').Router();
const { z } = require('zod');
const {
  getServices, getService, createService, updateService, deleteService, seedServices,
} = require('../controllers/serviceController');
const { protect, deptAdminGuard, superAdminGuard } = require('../middleware/auth');
const { cacheMiddleware, invalidateCache, TTL } = require('../middleware/cache');
const { validate } = require('../middleware/validate');
const { createServiceSchema, updateServiceSchema, mongoId } = require('../validations/schemas');

router.get('/', cacheMiddleware('services', TTL.LONG), getServices);
router.get('/:id', validate(z.object({ id: mongoId }), 'params'), cacheMiddleware('services:id', TTL.LONG), getService);
router.post('/seed', protect, superAdminGuard, seedServices);

const invalidateServices = (req, res, next) => {
  res.on('finish', () => { if (res.statusCode < 400) invalidateCache('services').catch(() => {}); });
  next();
};

router.post('/', protect, deptAdminGuard, invalidateServices, validate(createServiceSchema), createService);
router.put('/:id', protect, deptAdminGuard, invalidateServices, validate(z.object({ id: mongoId }), 'params'), validate(updateServiceSchema), updateService);
router.delete('/:id', protect, deptAdminGuard, invalidateServices, validate(z.object({ id: mongoId }), 'params'), deleteService);

module.exports = router;
