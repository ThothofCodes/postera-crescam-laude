// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const { uploadProductImages } = require('../middleware/upload');
const Inventory = require('../models/Inventory');

const inventoryController = {
  // Get all inventory items
  getAll: async (req, res) => {
    try {
      const {
        search, category, page = 1, limit = 20,
      } = req.query;
      const query = {};

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
        ];
      }

      if (category) {
        query.category = category;
      }

      const items = await Inventory.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

      const total = await Inventory.countDocuments(query);

      res.json({
        success: true,
        data: items,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error('Error getting inventory:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get inventory items',
      });
    }
  },

  // Get inventory item by ID
  getById: async (req, res) => {
    try {
      const item = await Inventory.findById(req.params.id);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found',
        });
      }
      res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      console.error('Error getting inventory item:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get inventory item',
      });
    }
  },

  // Create new inventory item
  create: async (req, res) => {
    try {
      // Handle file uploads if any
      const attachmentUrls = [];
      if (req.files && req.files.length > 0) {
        const urls = await uploadProductImages(req.files, 'inventory');
        attachmentUrls.push(...urls);
      }

      const newItem = new Inventory({
        ...req.body,
        attachments: attachmentUrls,
      });

      await newItem.save();

      res.status(201).json({
        success: true,
        data: newItem,
      });
    } catch (error) {
      console.error('Error creating inventory item:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create inventory item',
      });
    }
  },

  // Update inventory item
  update: async (req, res) => {
    try {
      // Get existing item to access existing attachments
      const existingItem = await Inventory.findById(req.params.id);
      if (!existingItem) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found',
        });
      }

      // Handle file uploads if any
      const updatedAttachmentUrls = [...(existingItem.attachments || [])]; // Keep existing attachments

      if (req.files && req.files.length > 0) {
        const urls = await uploadProductImages(req.files, 'inventory');
        updatedAttachmentUrls.push(...urls);
      }

      const updatedItem = await Inventory.findByIdAndUpdate(
        req.params.id,
        {
          ...req.body,
          attachments: updatedAttachmentUrls, // Update with combined attachments
        },
        { new: true, runValidators: true },
      );

      res.json({
        success: true,
        data: updatedItem,
      });
    } catch (error) {
      console.error('Error updating inventory item:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update inventory item',
      });
    }
  },

  // Delete inventory item
  delete: async (req, res) => {
    try {
      const item = await Inventory.findByIdAndDelete(req.params.id);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found',
        });
      }
      res.json({
        success: true,
        message: 'Inventory item deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete inventory item',
      });
    }
  },

  // Get low stock items
  getLowStock: async (req, res) => {
    try {
      const items = await Inventory.find({
        quantity: { $lte: '$reorderLevel' }, // Using aggregation to compare fields
      }).lean();

      // Since $lte with field comparison doesn't work directly in find,
      // we need to filter in memory
      const lowStockItems = items.filter((item) => item.quantity <= item.reorderLevel);

      res.json({
        success: true,
        data: lowStockItems,
        total: lowStockItems.length,
      });
    } catch (error) {
      console.error('Error getting low stock items:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get low stock items',
      });
    }
  },

  // Get items expiring within N days (default 30)
  getExpiring: async (req, res) => {
    try {
      const days = Math.max(1, Math.min(Number(req.query.days) || 30, 365));
      const now = new Date();
      const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const filter = {
        expiryDate: {
          $exists: true, $ne: null, $lte: cutoff, $gte: now,
        },
        isActive: true,
      };
      if (req.query.departmentSlug) filter.departmentSlug = req.query.departmentSlug;

      const items = await require('../models/Inventory')
        .find(filter)
        .sort('expiryDate')
        .limit(100);

      const data = items.map((item) => ({
        _id: item._id,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        departmentSlug: item.departmentSlug,
        expiryDate: item.expiryDate,
        daysUntilExpiry: Math.ceil((item.expiryDate - now) / (24 * 60 * 60 * 1000)),
      }));

      res.json({
        success: true, data, total: data.length, days,
      });
    } catch (error) {
      console.error('Error getting expiring items:', error);
      res.status(500).json({ success: false, message: 'Failed to get expiring items' });
    }
  },

  // Record inventory movement
  recordMovement: async (req, res) => {
    try {
      const {
        itemId, type, quantity,
      } = req.body;

      const item = await Inventory.findById(itemId);
      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found',
        });
      }

      // Update quantity based on movement type
      let newQuantity = item.quantity;
      switch (type) {
        case 'RESTOCK':
        case 'RETURN':
        case 'TRANSFER':
          newQuantity += parseInt(quantity, 10);
          break;
        case 'SALE':
        case 'JOB_USAGE':
        case 'DAMAGE_LOSS':
        case 'ADJUSTMENT':
          newQuantity -= parseInt(quantity, 10);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid movement type',
          });
      }

      // Ensure quantity doesn't go negative
      if (newQuantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock for this movement',
        });
      }

      // Update the item
      const updatedItem = await Inventory.findByIdAndUpdate(
        itemId,
        { quantity: newQuantity },
        { new: true },
      );

      // Here you could also log the movement in a separate collection if needed
      // For now, just return the updated item

      res.json({
        success: true,
        data: updatedItem,
        message: `Movement recorded: ${type} of ${quantity} units`,
      });
    } catch (error) {
      console.error('Error recording movement:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to record movement',
      });
    }
  },
};

module.exports = inventoryController;
