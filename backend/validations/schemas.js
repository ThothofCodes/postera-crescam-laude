// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Zod validation schemas for all API endpoints.
const { z } = require('zod');

// ── Shared primitives ───────────────────────────────────────────────────────
const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
const email = z.string().email('Invalid email address').max(200);
// Optional email that coerces empty string / whitespace-only to undefined
const optionalEmail = z.string().trim().transform((v) => v || undefined).pipe(z.string().email('Invalid email address').max(200).optional());
const phone = z.string().regex(/^\+?[0-9]{9,15}$/, 'Invalid phone number');
const name = z.string().min(2, 'Name must be at least 2 characters').max(100);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format').max(96);
const password = z.string().min(8, 'Password must be at least 8 characters').max(128);
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100)
  .default(20);

// ── Auth ────────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password required'),
  deviceFingerprint: z.string().max(500).optional(),
  deviceName: z.string().max(100).optional(),
});

const registerSchema = z.object({
  name,
  email,
  password,
  role: z.enum(['DEPT_HEAD_OWNER', 'STAFF']),
  department: mongoId.optional(),
  departmentSlug: z.string().max(50).optional(),
  isOwner: z.boolean().optional(),
});

const changeFirstPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: password,
}).refine((d) => d.currentPassword !== d.newPassword, {
  message: 'New password must be different from the temporary password',
  path: ['newPassword'],
});

const verifyTokenSchema = z.object({
  token: z.string().min(1, 'Token required'),
  userId: mongoId,
});

const setPasswordSchema = z.object({
  token: z.string().min(1, 'Token required'),
  userId: mongoId,
  password,
});

// ── Products ────────────────────────────────────────────────────────────────
const productCategory = z.enum(['electronics', 'accessories', 'software', 'services']);

const createProductSchema = z.object({
  name: z.string().min(1, 'Product name required').max(120),
  category: productCategory,
  description: z.string().min(1, 'Description required').max(2000),
  shortDesc: z.string().max(200).optional(),
  price: z.coerce.number().min(0, 'Price must be positive'),
  comparePrice: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  isDigital: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  warranty: z.string().max(100).optional(),
});

const updateProductSchema = createProductSchema.partial();

const productsQuerySchema = z.object({
  page,
  limit,
  sort: z.enum(['-createdAt', 'price', '-price', '-soldCount', 'name']).optional(),
  category: z.preprocess(
    (v) => ((v === '' || v === undefined || v === null) ? undefined : v),
    productCategory.optional(),
  ),
  search: z.preprocess(
    (v) => ((v === '' || v === undefined || v === null) ? undefined : v),
    z.string().max(100).optional(),
  ),
  featured: z.preprocess(
    (v) => ((v === '' || v === undefined || v === null) ? undefined : v),
    z.enum(['true', 'false']).optional(),
  ),
});

// ── Orders ──────────────────────────────────────────────────────────────────
const orderItemSchema = z.object({
  product: mongoId,
  quantity: z.coerce.number().int().min(1).max(999),
});

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'At least one item required').max(50),
  customer: z.object({
    name: z.string().min(1).max(100),
    phone,
    email: optionalEmail,
    deliveryAddress: z.string().max(500).optional(),
  }),
  deliveryType: z.enum(['pickup', 'delivery']).optional(),
  deliveryFee: z.coerce.number().min(0).max(10000).optional(),
  notes: z.string().max(500).optional(),
  paymentMethod: z.enum(['mpesa', 'cash', 'bank']).optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
});

const recordPaymentSchema = z.object({
  paymentMethod: z.enum(['mpesa', 'cash', 'bank']),
  mpesaRef: z.string().max(20).optional(),
  amount: z.coerce.number().positive().max(10_000_000),
});

const ordersQuerySchema = z.object({
  page,
  limit,
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
  paymentStatus: z.enum(['unpaid', 'paid', 'refunded']).optional(),
});

// ── Clients ─────────────────────────────────────────────────────────────────
const clientType = z.enum(['individual', 'sme', 'institution', 'ngo']);

const createClientSchema = z.object({
  name: name.min(2),
  phone,
  email: optionalEmail,
  clientType: clientType.optional(),
  notes: z.string().max(1000).optional(),
});

const updateClientSchema = z.object({
  name: name.optional(),
  phone: phone.optional(),
  email: optionalEmail,
  clientType: clientType.optional(),
  notes: z.string().max(1000).optional(),
});

const clientsQuerySchema = z.object({
  page,
  limit,
  search: z.string().max(100).optional(),
  clientType: clientType.optional(),
});

// ── Services ────────────────────────────────────────────────────────────────
const createServiceSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  price: z.coerce.number().min(0),
  category: z.string().max(50).optional(),
  department: z.string().max(50).optional(),
  isActive: z.coerce.boolean().optional(),
});

const updateServiceSchema = createServiceSchema.partial();

// ── Tickets ─────────────────────────────────────────────────────────────────
const ticketPriority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const createTicketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  departmentSlug: z.string().min(1).max(50),
  category: z.string().max(50).optional(),
  priority: ticketPriority.optional(),
});

const updateTicketStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'AWAITING_CLIENT', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED']),
});

const addTicketReplySchema = z.object({
  message: z.string().min(1).max(5000),
  attachments: z.array(z.string().max(500)).max(5).optional(),
});

// ── Billing / Invoices ──────────────────────────────────────────────────────
const lineItemSchema = z.object({
  description: z.string().min(1).max(200),
  qty: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
});

const createInvoiceSchema = z.object({
  clientId: mongoId,
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item required'),
  dueDate: z.string().or(z.date()),
  notes: z.string().max(500).optional(),
  taxRate: z.coerce.number().min(0).max(1).optional(),
});

const invoicesQuerySchema = z.object({
  page,
  limit,
  status: z.enum(['DRAFT', 'SENT', 'PAYMENT_SENT', 'PARTIAL', 'PAID', 'CANCELLED']).optional(),
  clientId: mongoId.optional(),
});

// ── Bookings ────────────────────────────────────────────────────────────────
const createBookingSchema = z.object({
  client: mongoId,
  service: mongoId,
  date: z.string().or(z.date()),
  time: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
});

// ── Consultations ───────────────────────────────────────────────────────────
const createConsultationSchema = z.object({
  clientName: z.string().min(1).max(100),
  clientEmail: email.optional(),
  clientPhone: phone.optional(),
  type: z.enum(['general', 'technical', 'strategic', 'other']).optional(),
  date: z.string().or(z.date()),
  time: z.string().max(20).optional(),
  notes: z.string().max(1000).optional(),
});

// ── Departments ─────────────────────────────────────────────────────────────
const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  slug,
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(10).optional(),
  isActive: z.boolean().optional(),
});

const updateDepartmentSchema = createDepartmentSchema.partial();

const setMonthlyTargetSchema = z.object({
  target: z.coerce.number().min(0),
});

// ── Inventory ───────────────────────────────────────────────────────────────
const createInventorySchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(50),
  quantity: z.coerce.number().int().min(0),
  unit: z.string().max(20).optional(),
  minStock: z.coerce.number().int().min(0).optional(),
  maxStock: z.coerce.number().int().min(0).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  supplier: z.string().max(100).optional(),
  expiryDate: z.string().or(z.date()).optional(),
  notes: z.string().max(500).optional(),
});

const updateInventorySchema = createInventorySchema.partial();

// ── CRM ─────────────────────────────────────────────────────────────────────
const createCRMClientSchema = z.object({
  fullName: z.string().min(1).max(100),
  phone,
  email: optionalEmail,
  company: z.string().max(100).optional(),
  clientType: z.enum(['individual', 'business', 'government']).optional(),
  notes: z.string().max(1000).optional(),
});

const updateCRMClientSchema = createCRMClientSchema.partial();

// ── Meetings ────────────────────────────────────────────────────────────────
const createMeetingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  scheduledAt: z.string().or(z.date()).optional(),
  duration: z.coerce.number().int().min(1).max(480)
    .optional(),
  department: z.string().max(50).optional(),
  participants: z.array(z.string().email()).max(50).optional(),
});

// ── Revenue ─────────────────────────────────────────────────────────────────
const createRevenueSchema = z.object({
  type: z.enum(['income', 'expense']),
  category: z.string().max(50),
  description: z.string().min(1).max(200),
  amount: z.coerce.number().min(0.01).max(10_000_000),
  paymentMethod: z.enum(['mpesa', 'cash', 'bank', 'other']).optional(),
  reference: z.string().max(20).optional(),
});

// ── Calculator ──────────────────────────────────────────────────────────────
const calculatorSchema = z.object({
  service: z.string().min(1).max(100),
  tier: z.enum(['basic', 'standard', 'premium']),
  complexity: z.enum(['low', 'medium', 'high']).optional(),
  rush: z.boolean().optional(),
});

const pricingRuleSchema = z.object({
  service: z.string().min(1).max(100),
  tier: z.enum(['basic', 'standard', 'premium']),
  basePrice: z.coerce.number().min(0).max(10_000_000),
  rushMultiplier: z.coerce.number().min(1).max(5),
});

// ── Pagination query (shared) ───────────────────────────────────────────────
const paginationQuery = z.object({ page, limit });

module.exports = {
  // Shared
  mongoId,
  email,
  phone,
  name,
  slug,
  password,
  page,
  limit,
  paginationQuery,
  // Auth
  loginSchema,
  registerSchema,
  changeFirstPasswordSchema,
  verifyTokenSchema,
  setPasswordSchema,
  // Products
  createProductSchema,
  updateProductSchema,
  productsQuerySchema,
  // Orders
  createOrderSchema,
  updateOrderStatusSchema,
  recordPaymentSchema,
  ordersQuerySchema,
  // Clients
  createClientSchema,
  updateClientSchema,
  clientsQuerySchema,
  // Services
  createServiceSchema,
  updateServiceSchema,
  // Tickets
  createTicketSchema,
  updateTicketStatusSchema,
  addTicketReplySchema,
  // Billing
  createInvoiceSchema,
  invoicesQuerySchema,
  // Bookings
  createBookingSchema,
  // Consultations
  createConsultationSchema,
  // Departments
  createDepartmentSchema,
  updateDepartmentSchema,
  setMonthlyTargetSchema,
  // Inventory
  createInventorySchema,
  updateInventorySchema,
  // CRM
  createCRMClientSchema,
  updateCRMClientSchema,
  // Meetings
  createMeetingSchema,
  // Revenue
  createRevenueSchema,
  // Calculator
  calculatorSchema,
  pricingRuleSchema,
};
