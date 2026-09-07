// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Zod validation middleware — replaces manual validation in controllers.
// Usage: router.post('/', validate(createProductSchema), controller.create)

/**
 * Express middleware factory — validates req.body, req.params, or req.query
 * against a Zod schema. Returns 402 with structured errors on failure.
 *
 * @param {import('zod').ZodObject} schema  — Zod schema to validate against
 * @param {'body'|'params'|'query'} source  — which part of the request to validate
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (result.success) {
      // Replace with parsed (coerced, defaulted, stripped) values
      req[source] = result.data;
      return next();
    }

    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    return res.status(400).json({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors,
    });
  };
}

/**
 * Validate multiple sources at once.
 * @param {{ body?: import('zod').ZodObject, params?: import('zod').ZodObject, query?: import('zod').ZodObject }} schemas
 */
function validateAll(schemas) {
  return (req, res, next) => {
    for (const [source, schema] of Object.entries(schemas)) {
      if (!schema) continue;
      const result = schema.safeParse(req[source]);
      if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
          field: `${source}.${issue.path.join('.')}`,
          message: issue.message,
          code: issue.code,
        }));
        return res.status(400).json({
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors,
        });
      }
      req[source] = result.data;
    }
    next();
  };
}

module.exports = { validate, validateAll };
