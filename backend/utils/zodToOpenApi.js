// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Custom Zod-to-OpenAPI converter — transforms Zod schemas into OpenAPI 3.0 components.
// Zero external dependencies — uses only Zod's built-in metadata.

/**
 * Convert a Zod schema to an OpenAPI 3.0 schema object.
 * Handles: strings, numbers, booleans, objects, arrays, enums, unions, optionals, defaults.
 */
function zodToOpenApi(schema, name = undefined) {
  if (!schema) return { type: 'object' };

  const def = schema._def || schema;

  // ── Zod effects (refine, transform, preprocess) — unwrap to inner type ──
  if (def.typeName === 'ZodEffects') {
    return zodToOpenApi(def.schema, name);
  }

  // ── Zod default — unwrap to inner type, mark as optional ──
  if (def.typeName === 'ZodDefault') {
    const inner = zodToOpenApi(def.innerType, name);
    return inner;
  }

  // ── Zod optional — unwrap to inner type ──
  if (def.typeName === 'ZodOptional') {
    return zodToOpenApi(def.innerType, name);
  }

  // ── Zod nullable — unwrap to inner type, add nullable ──
  if (def.typeName === 'ZodNullable') {
    const inner = zodToOpenApi(def.innerType, name);
    return { ...inner, nullable: true };
  }

  // ── Zod string ──
  if (def.typeName === 'ZodString') {
    const result = { type: 'string' };
    const checks = def.checks || [];

    for (const check of checks) {
      if (check.kind === 'email') result.format = 'email';
      else if (check.kind === 'url') result.format = 'url';
      else if (check.kind === 'uuid') result.format = 'uuid';
      else if (check.kind === 'datetime') result.format = 'date-time';
      else if (check.kind === 'min') result.minLength = check.value;
      else if (check.kind === 'max') result.maxLength = check.value;
      else if (check.kind === 'regex') result.pattern = check.regex.source;
    }

    return result;
  }

  // ── Zod number ──
  if (def.typeName === 'ZodNumber') {
    const result = { type: 'number' };
    const checks = def.checks || [];

    for (const check of checks) {
      if (check.kind === 'min') result.minimum = check.value;
      else if (check.kind === 'max') result.maximum = check.value;
      else if (check.kind === 'int') result.type = 'integer';
    }

    return result;
  }

  // ── Zod boolean ──
  if (def.typeName === 'ZodBoolean') {
    return { type: 'boolean' };
  }

  // ── Zod literal ──
  if (def.typeName === 'ZodLiteral') {
    return { type: typeof def.value, enum: [def.value] };
  }

  // ── Zod enum ──
  if (def.typeName === 'ZodEnum') {
    return { type: 'string', enum: [...def.values] };
  }

  // ── Zod nativeEnum ──
  if (def.typeName === 'ZodNativeEnum') {
    const values = Object.values(def.values).filter((v) => typeof v === 'string');
    return { type: 'string', enum: values };
  }

  // ── Zod array ──
  if (def.typeName === 'ZodArray') {
    return {
      type: 'array',
      items: zodToOpenApi(def.type),
    };
  }

  // ── Zod object ──
  if (def.typeName === 'ZodObject') {
    const properties = {};
    const required = [];

    const shape = def.shape();
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToOpenApi(value, key);

      // Determine if required
      const innerDef = value._def || value;
      if (
        innerDef.typeName !== 'ZodOptional'
        && innerDef.typeName !== 'ZodDefault'
        && innerDef.typeName !== 'ZodNullable'
      ) {
        required.push(key);
      }
    }

    const result = { type: 'object', properties };
    if (required.length > 0) result.required = required;
    return result;
  }

  // ── Zod union (oneOf) ──
  if (def.typeName === 'ZodUnion') {
    const options = def.options.map((opt) => zodToOpenApi(opt));
    return { oneOf: options };
  }

  // ── Zod discriminatedUnion ──
  if (def.typeName === 'ZodDiscriminatedUnion') {
    const options = def.options.map((opt) => zodToOpenApi(opt));
    return { oneOf: options };
  }

  // ── Zod record ──
  if (def.typeName === 'ZodRecord') {
    return {
      type: 'object',
      additionalProperties: zodToOpenApi(def.valueType),
    };
  }

  // ── Zod tuple ──
  if (def.typeName === 'ZodTuple') {
    return {
      type: 'array',
      items: { oneOf: def.items.map((item) => zodToOpenApi(item)) },
      minItems: def.items.length,
      maxItems: def.items.length,
    };
  }

  // ── Zod any / unknown / void ──
  if (['ZodAny', 'ZodUnknown', 'ZodVoid', 'ZodNever'].includes(def.typeName)) {
    return {};
  }

  // ── Fallback ──
  return { type: 'object' };
}

/**
 * Convert a Zod schema to an OpenAPI parameter definition (for query/params).
 */
function zodToOpenApiParams(schema, location = 'query') {
  if (!schema || !schema._def) return [];

  const def = schema._def;
  if (def.typeName !== 'ZodObject') return [];

  const params = [];
  const shape = def.shape();

  for (const [key, value] of Object.entries(shape)) {
    const param = {
      name: key,
      in: location,
      required: location === 'path',
    };

    const openApiSchema = zodToOpenApi(value);
    Object.assign(param, openApiSchema);

    // Add description from Zod checks
    const innerDef = value._def || value;
    if (innerDef.typeName === 'ZodOptional') {
      param.required = false;
    }

    params.push(param);
  }

  return params;
}

/**
 * Extract description from a Zod schema's description() call.
 */
function getDescription(schema) {
  const def = schema?._def;
  return def?.description || '';
}

module.exports = { zodToOpenApi, zodToOpenApiParams, getDescription };
