// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const express = require('express');

const router = express.Router();
const { z } = require('zod');
const productController = require('../controllers/productController');
const { protect, deptAdminGuard } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { cacheMiddleware, invalidateCache, TTL } = require('../middleware/cache');
const { validate } = require('../middleware/validate');
const {
  createProductSchema, updateProductSchema, productsQuerySchema, mongoId,
} = require('../validations/schemas');

// ── Public routes (cached) ───────────────────────────────────────────────────
router.get('/', validate(productsQuerySchema, 'query'), cacheMiddleware('products', TTL.MEDIUM), productController.getProducts);
router.get('/featured', cacheMiddleware('products:featured', TTL.LONG), productController.getFeatured);
router.get('/search', cacheMiddleware('products:search', TTL.MEDIUM), productController.search);
router.get('/slug/:slug', cacheMiddleware('products:slug', TTL.LONG), productController.getProductBySlug);
router.get('/:id', validate(z.object({ id: mongoId }), 'params'), cacheMiddleware('products:id', TTL.LONG), productController.getById);

// ── Protected routes ─────────────────────────────────────────────────────────
router.use(protect);
router.use(deptAdminGuard);

const invalidateProductCache = async (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode < 400) invalidateCache('products').catch(() => {});
  });
  next();
};

router.post('/', invalidateProductCache, validate(createProductSchema), upload.array('images', 5), productController.createProduct);
router.put('/:id', invalidateProductCache, validate(updateProductSchema), upload.array('images', 5), productController.updateProduct);
router.delete('/:id', invalidateProductCache, productController.deleteProduct);

module.exports = router;
