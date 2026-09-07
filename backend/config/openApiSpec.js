// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Auto-generated OpenAPI 3.0 spec — derived from Zod validation schemas.
// Any change to a Zod schema automatically updates the Swagger docs.
// No manual schema duplication required.

const { zodToOpenApi, zodToOpenApiParams } = require('../utils/zodToOpenApi');
const schemas = require('../validations/schemas');

// ── Convert Zod schemas to OpenAPI components ──────────────────────────────

function buildComponents() {
  const components = {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token from POST /api/v1/auth/login',
      },
    },
    schemas: {},
  };

  // Register all Zod schemas as OpenAPI components
  const schemaMap = {
    // Auth
    LoginRequest: schemas.loginSchema,
    RegisterRequest: schemas.registerSchema,
    ChangeFirstPasswordRequest: schemas.changeFirstPasswordSchema,
    VerifyTokenRequest: schemas.verifyTokenSchema,
    SetPasswordRequest: schemas.setPasswordSchema,

    // Products
    CreateProductRequest: schemas.createProductSchema,
    UpdateProductRequest: schemas.updateProductSchema,
    ProductsQuery: schemas.productsQuerySchema,

    // Orders
    CreateOrderRequest: schemas.createOrderSchema,
    UpdateOrderStatusRequest: schemas.updateOrderStatusSchema,
    RecordPaymentRequest: schemas.recordPaymentSchema,
    OrdersQuery: schemas.ordersQuerySchema,

    // Clients
    CreateClientRequest: schemas.createClientSchema,
    UpdateClientRequest: schemas.updateClientSchema,
    ClientsQuery: schemas.clientsQuerySchema,

    // Services
    CreateServiceRequest: schemas.createServiceSchema,
    UpdateServiceRequest: schemas.updateServiceSchema,

    // Tickets
    CreateTicketRequest: schemas.createTicketSchema,
    UpdateTicketStatusRequest: schemas.updateTicketStatusSchema,
    AddTicketReplyRequest: schemas.addTicketReplySchema,

    // Billing
    CreateInvoiceRequest: schemas.createInvoiceSchema,
    InvoicesQuery: schemas.invoicesQuerySchema,

    // Bookings
    CreateBookingRequest: schemas.createBookingSchema,

    // Consultations
    CreateConsultationRequest: schemas.createConsultationSchema,

    // Departments
    CreateDepartmentRequest: schemas.createDepartmentSchema,
    UpdateDepartmentRequest: schemas.updateDepartmentSchema,
    SetMonthlyTargetRequest: schemas.setMonthlyTargetSchema,

    // Inventory
    CreateInventoryRequest: schemas.createInventorySchema,
    UpdateInventoryRequest: schemas.updateInventorySchema,

    // CRM
    CreateCRMClientRequest: schemas.createCRMClientSchema,
    UpdateCRMClientRequest: schemas.updateCRMClientSchema,

    // Meetings
    CreateMeetingRequest: schemas.createMeetingSchema,

    // Revenue
    CreateRevenueRequest: schemas.createRevenueSchema,

    // Calculator
    CalculatorEstimate: schemas.calculatorSchema,
    PricingRule: schemas.pricingRuleSchema,
  };

  for (const [name, zodSchema] of Object.entries(schemaMap)) {
    components.schemas[name] = zodToOpenApi(zodSchema, name);
  }

  // Add shared/model schemas (not from Zod — response shapes)
  components.schemas.User = {
    type: 'object',
    properties: {
      _id: { type: 'string', description: 'MongoDB ObjectId' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['SUPER_ADMIN', 'DEPT_HEAD_OWNER', 'STAFF', 'admin', 'staff'] },
      department: { type: 'string', nullable: true },
      departmentSlug: { type: 'string', nullable: true },
      isActive: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  };

  components.schemas.Product = {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      category: { type: 'string', enum: ['electronics', 'accessories', 'software', 'services'] },
      description: { type: 'string' },
      price: { type: 'number' },
      stock: { type: 'integer' },
      isActive: { type: 'boolean' },
      images: { type: 'array', items: { type: 'string' } },
    },
  };

  components.schemas.Order = {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      orderNumber: { type: 'string', example: 'RTS-2026-00001' },
      customer: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' } } },
      items: { type: 'array', items: { type: 'object' } },
      totalAmount: { type: 'number' },
      status: { type: 'string', enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] },
      paymentStatus: { type: 'string', enum: ['unpaid', 'paid', 'refunded'] },
    },
  };

  components.schemas.Ticket = {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      ticketId: { type: 'string', example: 'RTS-REP-TKT-0001' },
      title: { type: 'string' },
      description: { type: 'string' },
      priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
      status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'AWAITING_CLIENT', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED'] },
    },
  };

  components.schemas.Error = {
    type: 'object',
    properties: {
      status: { type: 'integer' },
      code: { type: 'string' },
      message: { type: 'string' },
      details: { type: 'array', items: { type: 'object' } },
      timestamp: { type: 'string', format: 'date-time' },
      path: { type: 'string' },
      requestId: { type: 'string' },
    },
  };

  components.schemas.Pagination = {
    type: 'object',
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 20 },
      total: { type: 'integer' },
      pages: { type: 'integer' },
    },
  };

  components.schemas.ValidationError = {
    type: 'object',
    properties: {
      message: { type: 'string', example: 'Validation failed' },
      code: { type: 'string', example: 'VALIDATION_ERROR' },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
  };

  return components;
}

// ── Build paths from route metadata ────────────────────────────────────────

function buildPaths() {
  // Route definitions — each maps to a Zod request schema
  const routes = [
    // Auth
    {
      method: 'post', path: '/auth/login', tag: 'Auth', summary: 'Login', schema: 'LoginRequest', auth: false,
    },
    {
      method: 'post', path: '/auth/register', tag: 'Auth', summary: 'Register staff', schema: 'RegisterRequest', auth: true,
    },
    {
      method: 'get', path: '/auth/csrf-token', tag: 'Auth', summary: 'Get CSRF token', auth: false,
    },
    {
      method: 'post', path: '/auth/logout', tag: 'Auth', summary: 'Logout', auth: true,
    },
    {
      method: 'get', path: '/auth/me', tag: 'Auth', summary: 'Get current user', auth: true,
    },

    // Products
    {
      method: 'get', path: '/products', tag: 'Products', summary: 'List products', query: 'ProductsQuery', auth: false,
    },
    {
      method: 'post', path: '/products', tag: 'Products', summary: 'Create product', schema: 'CreateProductRequest', auth: true,
    },

    // Orders
    {
      method: 'get', path: '/orders', tag: 'Orders', summary: 'List orders', query: 'OrdersQuery', auth: true,
    },
    {
      method: 'post', path: '/orders', tag: 'Orders', summary: 'Create order', schema: 'CreateOrderRequest', auth: true,
    },

    // Clients
    {
      method: 'get', path: '/clients', tag: 'Clients', summary: 'List clients', query: 'ClientsQuery', auth: true,
    },
    {
      method: 'post', path: '/clients', tag: 'Clients', summary: 'Create client', schema: 'CreateClientRequest', auth: true,
    },

    // Services
    {
      method: 'get', path: '/services', tag: 'Services', summary: 'List services', auth: false,
    },
    {
      method: 'post', path: '/services', tag: 'Services', summary: 'Create service', schema: 'CreateServiceRequest', auth: true,
    },

    // Tickets
    {
      method: 'get', path: '/tickets', tag: 'Tickets', summary: 'List tickets', auth: true,
    },
    {
      method: 'post', path: '/tickets', tag: 'Tickets', summary: 'Create ticket', schema: 'CreateTicketRequest', auth: true,
    },

    // Billing
    {
      method: 'get', path: '/billing', tag: 'Billing', summary: 'List invoices', query: 'InvoicesQuery', auth: true,
    },
    {
      method: 'post', path: '/billing', tag: 'Billing', summary: 'Create invoice', schema: 'CreateInvoiceRequest', auth: true,
    },

    // Bookings
    {
      method: 'get', path: '/bookings', tag: 'Bookings', summary: 'List bookings', auth: true,
    },
    {
      method: 'post', path: '/bookings', tag: 'Bookings', summary: 'Create booking', schema: 'CreateBookingRequest', auth: true,
    },

    // Consultations
    {
      method: 'get', path: '/consultations', tag: 'Consultations', summary: 'List consultations', auth: true,
    },
    {
      method: 'post', path: '/consultations', tag: 'Consultations', summary: 'Create consultation', schema: 'CreateConsultationRequest', auth: true,
    },

    // Departments
    {
      method: 'get', path: '/departments', tag: 'Departments', summary: 'List departments', auth: false,
    },
    {
      method: 'post', path: '/departments', tag: 'Departments', summary: 'Create department', schema: 'CreateDepartmentRequest', auth: true,
    },

    // Inventory
    {
      method: 'get', path: '/inventory', tag: 'Inventory', summary: 'List inventory', auth: true,
    },
    {
      method: 'post', path: '/inventory', tag: 'Inventory', summary: 'Create inventory item', schema: 'CreateInventoryRequest', auth: true,
    },

    // CRM
    {
      method: 'get', path: '/crm', tag: 'CRM', summary: 'List CRM clients', auth: true,
    },
    {
      method: 'post', path: '/crm', tag: 'CRM', summary: 'Create CRM client', schema: 'CreateCRMClientRequest', auth: true,
    },

    // Revenue
    {
      method: 'get', path: '/revenue', tag: 'Revenue', summary: 'List revenue entries', auth: true,
    },
    {
      method: 'post', path: '/revenue', tag: 'Revenue', summary: 'Create revenue entry', schema: 'CreateRevenueRequest', auth: true,
    },

    // Calculator
    {
      method: 'post', path: '/calculator/estimate', tag: 'Calculator', summary: 'Get price estimate', schema: 'CalculatorEstimate', auth: false,
    },

    // Monetization
    {
      method: 'get', path: '/monetization/ads/active', tag: 'Monetization', summary: 'Get active ads', auth: false,
    },
    {
      method: 'post', path: '/monetization/promos/validate', tag: 'Monetization', summary: 'Validate promo code', auth: false,
    },

    // Meetings
    {
      method: 'get', path: '/meetings/rooms', tag: 'Meetings', summary: 'List meeting rooms', auth: true,
    },
    {
      method: 'post', path: '/meetings/rooms', tag: 'Meetings', summary: 'Create meeting room', schema: 'CreateMeetingRequest', auth: true,
    },

    // Tech Hub
    {
      method: 'get', path: '/tech-hub/public/articles', tag: 'Tech Hub', summary: 'List published articles', auth: false,
    },

    // Help
    {
      method: 'get', path: '/help/faq', tag: 'Help', summary: 'Get FAQ', auth: false,
    },
    {
      method: 'get', path: '/help/troubleshooting', tag: 'Help', summary: 'Get troubleshooting guides', auth: false,
    },
    {
      method: 'get', path: '/help/knowledge-base', tag: 'Help', summary: 'Get knowledge base', auth: false,
    },

    // Analytics
    {
      method: 'get', path: '/analytics/summary', tag: 'Analytics', summary: 'Get analytics summary', auth: true,
    },

    // Admin
    {
      method: 'get', path: '/admin/stats', tag: 'Admin', summary: 'Get dashboard stats', auth: true,
    },
    {
      method: 'get', path: '/admin/revenue', tag: 'Admin', summary: 'Get revenue chart data', auth: true,
    },

    // Health
    {
      method: 'get', path: '/health', tag: 'System', summary: 'Health check', auth: false,
    },
    {
      method: 'get', path: '/ready', tag: 'System', summary: 'Readiness check', auth: false,
    },
    {
      method: 'get', path: '/versions', tag: 'System', summary: 'API version discovery', auth: false,
    },
  ];

  const paths = {};

  for (const route of routes) {
    if (!paths[route.path]) paths[route.path] = {};

    const operation = {
      summary: route.summary,
      tags: [route.tag],
      operationId: `${route.tag.toLowerCase()}_${route.method}_${route.path.replace(/\//g, '_').replace(/^_/, '')}`,
    };

    // Request body
    if (route.schema) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${route.schema}` },
          },
        },
      };
    }

    // Query parameters
    if (route.query) {
      const querySchema = schemas[route.query];
      if (querySchema) {
        operation.parameters = zodToOpenApiParams(querySchema, 'query');
      }
    }

    // Authentication
    if (route.auth !== false) {
      operation.security = [{ bearerAuth: [] }];
    }

    // Response
    operation.responses = {
      200: {
        description: 'Success',
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      400: {
        description: 'Validation error',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } },
      },
      401: {
        description: 'Unauthorized',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      500: {
        description: 'Server error',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    };

    paths[route.path][route.method] = operation;
  }

  return paths;
}

// ── Build the complete OpenAPI spec ────────────────────────────────────────

function generateSpec() {
  return {
    openapi: '3.0.0',
    info: {
      title: 'PCL — Postera Crescam Laude API',
      version: '1.0.0',
      description: `
## Overview
Backend API for the PCL (Postera Crescam Laude) integrated platform — internet distribution, web development, PlayStation arena, hardware repair, cybersecurity, and government admin assistance.

## Authentication
All protected endpoints require a JWT Bearer token in the Authorization header.
Obtain a token via \`POST /api/v1/auth/login\`.

## Rate Limits
- **Global**: Role-based (60-800 requests / 15 min)
- **Auth endpoints**: 10 attempts / 15 min + progressive brute-force delay
- **Write operations**: Role-based (5-100 mutations / 15 min)

## API Versioning
All endpoints are available at \`/api/v1/\`. Legacy \`/api/\` paths still work but return a \`Deprecation\` header.

## Compression
Responses use Brotli (preferred) or Gzip compression when the client supports it.

## Validation
All request bodies are validated using Zod schemas. Invalid requests return structured \`400\` errors with field-level details.
      `.trim(),
      contact: { name: 'PCL Tech Support', email: 'support@pcl.co.ke' },
      license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
    },
    servers: [
      { url: 'http://localhost:5001', description: 'Development server' },
      { url: 'https://api.pclsolutions.co.ke', description: 'Production server' },
    ],
    components: buildComponents(),
    paths: buildPaths(),
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication & session management' },
      { name: 'Products', description: 'Product catalog management' },
      { name: 'Orders', description: 'Order processing & tracking' },
      { name: 'Clients', description: 'Client management' },
      { name: 'Services', description: 'Service catalog' },
      { name: 'Tickets', description: 'Support ticket system' },
      { name: 'Billing', description: 'Invoice & billing management' },
      { name: 'Bookings', description: 'Appointment scheduling' },
      { name: 'Consultations', description: 'Consultation management' },
      { name: 'Departments', description: 'Department administration' },
      { name: 'Inventory', description: 'Stock & inventory tracking' },
      { name: 'CRM', description: 'Customer relationship management' },
      { name: 'Revenue', description: 'Revenue tracking & ledger' },
      { name: 'Calculator', description: 'Service pricing calculator' },
      { name: 'Monetization', description: 'Ads, promo codes, platform fees' },
      { name: 'Meetings', description: 'LiveKit video meetings' },
      { name: 'Tech Hub', description: 'Tech articles & blog' },
      { name: 'Help', description: 'Help desk & knowledge base' },
      { name: 'Analytics', description: 'Analytics & reporting' },
      { name: 'Admin', description: 'Admin dashboard & system management' },
      { name: 'System', description: 'Health checks & versioning' },
    ],
  };
}

module.exports = { generateSpec };
