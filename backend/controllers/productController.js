// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { uploadProductImages } = require('../middleware/upload');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const safePage = (p) => Math.max(1, Math.min(Number(p) || 1, 1000));
const safeLimit = (l) => Math.max(1, Math.min(Number(l) || 20, 100));
const VALID_CATS = ['electronics', 'accessories', 'software', 'services'];
const VALID_SORT = ['-createdAt', 'price', '-price', '-soldCount', 'name'];

const parseBody = (body) => {
  if (typeof body.tags === 'string') body.tags = body.tags.split(',').map((t) => t.trim().slice(0, 50)).filter(Boolean).slice(0, 20);
  ['isDigital', 'isActive', 'featured'].forEach((k) => {
    if (body[k] === 'true') body[k] = true;
    else if (body[k] === 'false') body[k] = false;
  });
  if (body.price !== undefined) body.price = Math.max(0, Number(body.price) || 0);
  if (body.comparePrice !== undefined) body.comparePrice = Math.max(0, Number(body.comparePrice) || 0) || undefined;
  if (body.stock !== undefined) body.stock = Math.max(0, Math.floor(Number(body.stock) || 0));
  if (body.name) body.name = body.name.trim().slice(0, 120);
  if (body.shortDesc) body.shortDesc = body.shortDesc.trim().slice(0, 200);
  if (body.description) body.description = body.description.trim().slice(0, 2000);
  if (body.warranty) body.warranty = body.warranty.trim().slice(0, 100);
  return body;
};

exports.getProducts = async (req, res, next) => {
  try {
    const page = safePage(req.query.page); const
      limit = safeLimit(req.query.limit);
    const sort = VALID_SORT.includes(req.query.sort) ? req.query.sort : '-createdAt';
    const query = { isActive: true };

    // Handle featured products request
    if (req.query.featured === 'true') {
      query.featured = true;
    }

    // Handle search query
    if (req.query.search) {
      const safe = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
      query.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { shortDesc: { $regex: safe, $options: 'i' } },
        { tags: { $in: [new RegExp(safe, 'i')] } },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort(sort)
        .limit(limit)
        .skip((page - 1) * limit),
      Product.countDocuments(query),
    ]);

    res.json({
      products,
      pagination: {
        page, limit, total, pages: Math.ceil(total / limit),
      },
    });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid product ID' });
    const product = await Product.findById(req.params.id).where({ isActive: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) { next(err); }
};

exports.getFeatured = async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true, featured: true }).limit(10);
    res.json(products);
  } catch (err) { next(err); }
};

exports.search = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: 'Search query required' });

    const safeQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
    const products = await Product.find({
      isActive: true,
      $or: [
        { name: { $regex: safeQuery, $options: 'i' } },
        { description: { $regex: safeQuery, $options: 'i' } },
        { shortDesc: { $regex: safeQuery, $options: 'i' } },
        { tags: { $in: [new RegExp(safeQuery, 'i')] } },
      ],
    }).limit(20);

    res.json(products);
  } catch (err) { next(err); }
};

exports.getProductBySlug = async (req, res, next) => {
  try {
    const slug = req.params.slug?.replace(/[^a-z0-9-]/gi, '').slice(0, 150);
    if (!slug) return res.status(400).json({ message: 'Invalid slug' });
    const product = await Product.findOne({ slug, isActive: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) { next(err); }
};

exports.createProduct = async (req, res, next) => {
  try {
    const body = parseBody(req.body);
    if (!body.name) return res.status(400).json({ message: 'Product name required' });
    if (!VALID_CATS.includes(body.category)) return res.status(400).json({ message: 'Invalid category' });
    if (!body.description) return res.status(400).json({ message: 'Description required' });
    if (body.price === undefined || body.price < 0) return res.status(400).json({ message: 'Valid price required' });

    if (req.files?.length) {
      body.images = await uploadProductImages(req.files);
    }

    const product = await Product.create(body);
    res.status(201).json(product);
  } catch (err) { next(err); }
};

exports.updateProduct = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid product ID' });
    const body = parseBody(req.body);
    if (body.category && !VALID_CATS.includes(body.category)) return res.status(400).json({ message: 'Invalid category' });
    if (!body.name) delete body.name;

    if (req.files?.length) {
      body.images = await uploadProductImages(req.files);
    }

    const product = await Product.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) { next(err); }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid product ID' });
    await Product.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Product deactivated' });
  } catch (err) { next(err); }
};

exports.seedProducts = async (req, res, next) => {
  try {
    await Product.deleteMany({});
    const SEED = [
      {
        name: 'Refurbished Laptop Core i5', category: 'electronics', description: 'Refurbished Core i5 laptop, 8GB RAM, 256GB SSD.', shortDesc: 'Core i5, 8GB RAM, 256GB SSD', price: 45000, comparePrice: 55000, stock: 5, warranty: '3 months', featured: true,
      },
      {
        name: 'Wireless Mouse & Keyboard Combo', category: 'accessories', description: 'Wireless combo, 2.4GHz, USB receiver.', shortDesc: 'Wireless combo', price: 2500, stock: 20,
      },
      {
        name: 'Antivirus Licence 1 Year', category: 'software', description: '1 device, 1 year. Email delivery.', shortDesc: '1 device, 1 year', price: 3000, isDigital: true,
      },
      {
        name: 'Starter Website Package', category: 'services', description: '5-page website with hosting and domain.', shortDesc: '5 pages, hosting + domain', price: 15000, isDigital: true, featured: true,
      },
    ];
    const products = await Product.insertMany(SEED);
    res.status(201).json({ message: `${products.length} products seeded` });
  } catch (err) { next(err); }
};
