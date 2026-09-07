// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const mongoose = require('mongoose');
const Client = require('../models/Client');

exports.getClients = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 20, search, clientType,
    } = req.query;
    const query = {};
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
      query.$or = [{ name: new RegExp(safe, 'i') }, { phone: new RegExp(safe, 'i') }];
    }
    if (clientType) query.clientType = clientType;
    const [clients, total] = await Promise.all([
      Client.find(query).sort('-createdAt').skip((page - 1) * limit).limit(limit),
      mongoose.connection.readyState === 1 ? Client.countDocuments(query) : Promise.resolve(0),
    ]);
    res.json({
      clients, total, page, pages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
};

exports.getClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (err) { next(err); }
};

exports.createClient = async (req, res, next) => {
  try {
    const client = await Client.create({
      name: req.body.name.trim(),
      phone: req.body.phone.replace(/\D/g, '').slice(0, 15),
      email: req.body.email?.toLowerCase().trim(),
      clientType: req.body.clientType || 'individual',
      notes: req.body.notes?.trim(),
    });
    res.status(201).json(client);
  } catch (err) { next(err); }
};

exports.updateClient = async (req, res, next) => {
  try {
    const update = {};
    if (req.body.name) update.name = req.body.name.trim();
    if (req.body.phone) update.phone = req.body.phone.replace(/\D/g, '').slice(0, 15);
    if (req.body.email) update.email = req.body.email.toLowerCase().trim();
    if (req.body.clientType) update.clientType = req.body.clientType;
    if (req.body.notes !== undefined) update.notes = req.body.notes.trim();
    const client = await Client.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (err) { next(err); }
};

exports.deleteClient = async (req, res, next) => {
  try {
    await Client.findByIdAndDelete(req.params.id);
    res.json({ message: 'Client deleted' });
  } catch (err) { next(err); }
};
