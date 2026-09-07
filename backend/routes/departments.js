// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const router = require('express').Router();
const { z } = require('zod');
const {
  getDepartments, getDepartment, updateDepartment, setMonthlyTarget,
  seedDepartments, createDepartment, deleteDepartment,
  getAllDepartments, toggleDepartment,
} = require('../controllers/departmentController');
const { protect, superAdminGuard, deptHeadGuard } = require('../middleware/auth');
const { cacheMiddleware, invalidateCache, TTL } = require('../middleware/cache');
const { validate } = require('../middleware/validate');
const {
  createDepartmentSchema, updateDepartmentSchema, setMonthlyTargetSchema, slug,
} = require('../validations/schemas');

router.get('/', cacheMiddleware('departments', TTL.STATIC), getDepartments);
router.get('/all', protect, superAdminGuard, cacheMiddleware('departments:all', TTL.STATIC), getAllDepartments);
router.get('/:slug', protect, cacheMiddleware('departments:slug', TTL.STATIC), getDepartment);

const invalidateDepts = (req, res, next) => {
  res.on('finish', () => { if (res.statusCode < 400) invalidateCache('departments').catch(() => {}); });
  next();
};

router.post('/', protect, superAdminGuard, invalidateDepts, validate(createDepartmentSchema), createDepartment);
router.post('/seed', protect, superAdminGuard, invalidateDepts, seedDepartments);
router.put('/:slug', protect, deptHeadGuard, invalidateDepts, validate(z.object({ slug }), 'params'), validate(updateDepartmentSchema), updateDepartment);
router.put('/:slug/toggle', protect, superAdminGuard, invalidateDepts, validate(z.object({ slug }), 'params'), toggleDepartment);
router.delete('/:slug', protect, superAdminGuard, invalidateDepts, validate(z.object({ slug }), 'params'), deleteDepartment);
router.post('/:slug/target', protect, superAdminGuard, invalidateDepts, validate(z.object({ slug }), 'params'), validate(setMonthlyTargetSchema), setMonthlyTarget);

module.exports = router;
