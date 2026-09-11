// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Ambient TypeScript type declarations for core data models.
// These are available via `import type { ... } from '../types'` in any .ts/.tsx file.

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'SITE_MANAGER' | 'DEPT_HEAD_OWNER' | 'STAFF' | 'admin' | 'staff';
  department?: Department | string | null;
  departmentSlug?: string | null;
  isOwner: boolean;
  superAdminLocked: boolean;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  category: 'electronics' | 'accessories' | 'software' | 'services';
  description: string;
  shortDesc?: string;
  price: number;
  comparePrice?: number;
  images: string[];
  stock: number;
  isDigital: boolean;
  isActive: boolean;
  featured: boolean;
  tags: string[];
  rating: number;
  reviewCount: number;
  soldCount: number;
  sku?: string;
  warranty: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface OrderItem {
  product?: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
    location?: string;
    deliveryAddress?: string;
  };
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  paymentMethod?: 'mpesa' | 'cash' | 'bank';
  mpesaRef?: string;
  checkoutRequestId?: string;
  deliveryType: 'pickup' | 'delivery';
  notes?: string;
  confirmedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  department?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  _id: string;
  ticketId: string;
  department: string;
  departmentSlug: string;
  raisedBy: string;
  raisedByRole: 'CLIENT' | 'STAFF';
  assignedTo?: string | null;
  title: string;
  description: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'AWAITING_CLIENT' | 'ESCALATED' | 'RESOLVED' | 'CLOSED' | 'REOPENED';
  slaDeadline?: string;
  slaBreach: boolean;
  thread: ThreadEntry[];
  attachments: string[];
  resolvedAt?: string;
  closedAt?: string;
  satisfactionScore?: number | null;
  escalatedTo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadEntry {
  author: string;
  authorRole: 'SUPER_ADMIN' | 'SITE_MANAGER' | 'DEPT_HEAD_OWNER' | 'STAFF' | 'CLIENT';
  message: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Consultation {
  _id: string;
  client: string;
  service: string;
  department: string;
  departmentSlug: string;
  scheduledAt: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  client: string;
  items: Array<{
    description: string;
    amount: number;
    quantity: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id: string;
  sender: string;
  senderRole: string;
  message: string;
  room: string;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
}

// ── API response types ────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  pages: number;
  page: number;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: Array<{ field: string; message: string; kind?: string }>;
  timestamp: string;
  path: string;
  requestId?: string;
}

// ── Socket event types ────────────────────────────────────────────────────────

export interface SocketEvents {
  // Client → Server
  'join-room': (room: string) => void;
  'leave-room': (room: string) => void;
  'send-message': (data: { room: string; message: string }) => void;
  'typing': (data: { room: string; isTyping: boolean }) => void;
  'read-receipt': (data: { room: string; messageId: string }) => void;

  // Server → Client
  'new-message': (message: ChatMessage) => void;
  'user-typing': (data: { userId: string; room: string; isTyping: boolean }) => void;
  'message-read': (data: { messageId: string; readBy: string }) => void;
  'user-online': (data: { userId: string }) => void;
  'user-offline': (data: { userId: string }) => void;
}
