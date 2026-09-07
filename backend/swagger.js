// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Swagger/OpenAPI spec — auto-generated from Zod validation schemas.
// When you update a Zod schema in validations/schemas.js, the Swagger docs
// update automatically. No manual schema duplication required.

const { generateSpec } = require('./config/openApiSpec');

// Generate the spec once at startup
const swaggerSpec = generateSpec();

module.exports = { swaggerSpec };
