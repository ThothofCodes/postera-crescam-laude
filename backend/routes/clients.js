// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const express = require('express');

const router = express.Router();
const { z } = require('zod');
const {
  getClients, getClient, createClient, updateClient, deleteClient,
} = require('../controllers/clientController');
const { protect, staff } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createClientSchema, updateClientSchema, clientsQuerySchema, mongoId,
} = require('../validations/schemas');

router.get('/', protect, staff, validate(clientsQuerySchema, 'query'), getClients);
router.get('/:id', protect, staff, validate(z.object({ id: mongoId }), 'params'), getClient);
router.post('/', protect, staff, validate(createClientSchema), createClient);
router.put('/:id', protect, staff, validate(z.object({ id: mongoId }), 'params'), validate(updateClientSchema), updateClient);
router.delete('/:id', protect, staff, validate(z.object({ id: mongoId }), 'params'), deleteClient);

module.exports = router;
