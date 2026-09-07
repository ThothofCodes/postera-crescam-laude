// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import React, { Suspense } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAuth, useAuthStore } from './store/authStore';
import { useCartStore } from './store/cartStore';
import { useAdminStore, useAdminAuth, initializeAdminAuth } from './store/adminStore';
import useSocket from './hooks/useSocket';
import useInactivityTimer from './hooks/useInactivityTimer';
import { initCsrf } from './utils/api';
import { trackPageView } from './utils/analytics';
import { initErrorTracker } from './utils/errorTracker';

import AdminPrivateRoute from './admin/components/AdminPrivateRoute';
import AdminLayout from './admin/components/AdminLayout';
import DeptLayout from './admin/components/DeptLayout';

// ── Eager imports (small, needed immediately) ────────────────────────────────
import Login from './pages/Login';
import PublicServices from './pages/PublicServices';
import Contact from './pages/Contact';
import TrackTicket from './pages/TrackTicket';
import PublicLayout from './layouts/PublicLayout';
import ChatWidget from './components/ChatWidget';
import { SuperAdminLayout } from './admin/pages/super/SuperDashboard';

// ── Lazy-loaded pages (code-split for smaller initial bundle) ───────────────
const Store = React.lazy(() => import('./pages/Store'));
const ProductDetail = React.lazy(() => import('./pages/ProductDetail'));
const Cart = React.lazy(() => import('./pages/Cart'));
const Checkout = React.lazy(() => import('./pages/Checkout'));
const OrderStatus = React.lazy(() => import('./pages/OrderStatus'));
const Calculator = React.lazy(() => import('./pages/Calculator'));
const ConsultLanding = React.lazy(() => import('./pages/ConsultLanding'));
const ConsultBook = React.lazy(() => import('./pages/ConsultBook'));
const HelpDesk = React.lazy(() => import('./pages/HelpDesk'));
const TechInsights = React.lazy(() => import('./pages/TechInsights'));
const CookiePolicy = React.lazy(() => import('./pages/CookiePolicy'));
const TechHubLocal = React.lazy(() => import('./pages/TechHubLocal'));
const BlogManagement = React.lazy(() => import('./admin/pages/shared/BlogManagement'));
const TechStudio = React.lazy(() => import('./admin/pages/super/TechStudio'));
const PublicWebPortal = React.lazy(() => import('./pages/PublicWebPortal'));
const Callbacks = React.lazy(() => import('./pages/Callbacks'));
const AccessDenied = React.lazy(() => import('./pages/AccessDenied'));
const ReceiptPage = React.lazy(() => import('./pages/ReceiptPage'));
const SetPassword = React.lazy(() => import('./pages/staff/SetPassword'));
const StaffDashboard = React.lazy(() => import('./pages/staff/StaffDashboard'));
const ClientPortal = React.lazy(() => import('./pages/client/ClientPortal'));

// ── Lazy-loaded admin pages ──────────────────────────────────────────────
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Clients = React.lazy(() => import('./pages/Clients'));
const Services = React.lazy(() => import('./pages/Services'));
const Bookings = React.lazy(() => import('./pages/Bookings'));
const Products = React.lazy(() => import('./pages/Products'));
const Orders = React.lazy(() => import('./pages/Orders'));
const Consultations = React.lazy(() => import('./pages/Consultations'));
const Revenue = React.lazy(() => import('./pages/Revenue'));
const Settings = React.lazy(() => import('./pages/Settings'));
const DeptStaff = React.lazy(() => import('./pages/DeptStaff'));
const AdminChatControl = React.lazy(() => import('./pages/AdminChatControl'));
const AdminRevenueDashboard = React.lazy(() => import('./pages/AdminRevenueDashboard'));
import SuperDashboard from './admin/pages/super/SuperDashboard'; // already imported above for SuperAdminLayout
const UserManagement = React.lazy(() => import('./admin/pages/super/UserManagement'));
const DepartmentsPage = React.lazy(() => import('./admin/pages/super/Departments'));
const DeviceManagement = React.lazy(() => import("./admin/pages/super/DeviceManagement"));
const SessionsPage = React.lazy(() => import('./admin/pages/playstation/Sessions'));
const JobCards = React.lazy(() => import('./admin/pages/repair/JobCards'));
const EmailAllocationPage = React.lazy(() => import('./admin/pages/shared/EmailAllocationPage'));
const FinancePage = React.lazy(() => import('./admin/pages/shared/FinancePage'));
const AuditLogPage = React.lazy(() => import('./admin/pages/shared/AuditLogPage'));
const BroadcastPage = React.lazy(() => import('./admin/pages/shared/BroadcastPage'));
const SettingsPage = React.lazy(() => import('./admin/pages/shared/SettingsPage'));
const HealthDashboard = React.lazy(() => import('./admin/pages/shared/HealthDashboard'));
const TransactionsPage = React.lazy(() => import('./admin/pages/shared/TransactionsPage'));
const ExpensesPage = React.lazy(() => import('./admin/pages/shared/ExpensesPage'));
const InventoryPage = React.lazy(() => import('./admin/pages/shared/InventoryPage'));
const TicketsPage = React.lazy(() => import('./admin/pages/shared/TicketsPage'));
const StaffPortalAdmin = React.lazy(() => import('./admin/pages/shared/StaffPortalAdmin'));
const MessagesPage = React.lazy(() => import('./admin/pages/shared/MessagesPage'));
const StaffInvitation = React.lazy(() => import('./admin/pages/shared/StaffInvitation'));
const CRMPage = React.lazy(() => import('./admin/pages/shared/CRMPage'));
const BillingPage = React.lazy(() => import('./admin/pages/shared/BillingPage'));
const ForcePasswordChange = React.lazy(() => import('./admin/pages/ForcePasswordChange'));
const DepartmentAdminAllocation = React.lazy(() => import('./admin/pages/super/DepartmentAdminAllocation'));
const DepartmentManagement = React.lazy(() => import('./admin/pages/super/DepartmentManagement'));
const DepartmentAnalytics = React.lazy(() => import('./admin/pages/super/DepartmentAnalytics'));
const PaymentHistory = React.lazy(() => import('./admin/pages/super/PaymentHistory'));
const MeetingScheduler = React.lazy(() => import('./admin/pages/super/MeetingScheduler'));
const MonetizationDashboard = React.lazy(() => import('./admin/pages/super/MonetizationDashboard'));
const ErrorTracker = React.lazy(() => import('./admin/pages/super/ErrorTracker'));
const InternetLanding = React.lazy(() => import('./admin/pages/internet/Landing'));
const ISPClients = React.lazy(() => import('./admin/pages/internet/Clients'));
const WebDevLanding = React.lazy(() => import('./admin/pages/webdev/Landing'));
const ProjectsPage = React.lazy(() => import('./admin/pages/webdev/Projects'));
const PlayStationLanding = React.lazy(() => import('./admin/pages/playstation/Landing'));
const RepairLanding = React.lazy(() => import('./admin/pages/repair/Landing'));
const CybersecurityLanding = React.lazy(() => import('./admin/pages/cybersecurity/Landing'));
const SecurityContracts = React.lazy(() => import('./admin/pages/cybersecurity/Contracts'));
const GovAdminLanding = React.lazy(() => import('./admin/pages/govadmin/Landing'));
const DynamicDepartmentLanding = React.lazy(() => import('./admin/pages/DynamicDepartmentLanding'));
const GovDocs = React.lazy(() => import('./admin/pages/govadmin/GovDocs'));

import DBStatusBanner from './components/DBStatusBanner';
import CookieConsent from './components/CookieConsent';
import BootScreen from './components/BootScreen';
import ErrorBoundary from './components/ErrorBoundary';
import PageTransition from './components/PageTransition';
import { Spinner } from './components/UI';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    trackPageView(pathname, document.title);
  }, [pathname]);
  return null;
}

function DynamicDeptRoute() {
  const { slug } = useParams();
  return <DeptLayout slug={slug} title="Department" />;
}

function RedirectToAppropriatePage() {
  return <Navigate to="/store" replace />;
}

function ConditionalChatWidget() {
  const location = useLocation();

  // Hide the customer-facing widget on admin/staff/client areas,
  // plus any admin chat UI routes (chat overlays/modals).
  const isNonPublicRoute =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/staff') ||
    location.pathname.startsWith('/client') ||
    location.pathname === '/chat'; // Also hide on dedicated chat route

  if (isNonPublicRoute) return null;
  return <ChatWidget isAdmin={false} />;
}

export default function App() {
  const [bootComplete, setBootComplete] = useState(sessionStorage.getItem('pcl_booted'));
  const handleBootComplete = useCallback(() => {
    sessionStorage.setItem('pcl_booted', '1');
    setBootComplete(true);
  }, []);

  // Lock body scroll while boot screen is visible
  useEffect(() => {
    if (!bootComplete) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [bootComplete]);

  // Fetch CSRF token on mount (sets _csrf cookie for CSRF protection)
  useEffect(() => { initCsrf(); initErrorTracker(); }, []);

  // Initialize auth state from persisted token
  useEffect(() => {
    useAuthStore.getState().initialize();
    initializeAdminAuth();
  }, []);

  // Initialize global socket connection
  useSocket();

  // Auto-logout on inactivity (30 min default, configurable via SESSION_IDLE_TIMEOUT_MINUTES)
  const handleIdleLogout = useCallback(() => {
    const hasAdminToken = !!localStorage.getItem('adminToken');
    const hasUser = !!useAuthStore.getState().user;
    if (hasAdminToken) {
      useAdminAuth.getState().logout();
    } else if (hasUser) {
      useAuthStore.getState().logout();
    }
    window.location.href = '/login';
  }, []);

  const idleTimeoutMs = parseInt(import.meta.env.VITE_SESSION_IDLE_TIMEOUT_MINUTES || '30', 10) * 60 * 1000;
  useInactivityTimer(handleIdleLogout, idleTimeoutMs);

  return (
    <div data-testid="app-container">
      {!bootComplete && <BootScreen onComplete={handleBootComplete} />}
      <BrowserRouter>
              <ScrollToTop />
              <DBStatusBanner />

              <ErrorBoundary><PageTransition><Suspense fallback={<Spinner />}><Routes>
                {/* ── Public pages ── */}
                {/* NOTE: public /services must be registered before legacy admin routes */}
                <Route path="/services" element={<PublicServices />} />

                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Login />} />
                <Route path="/forgot" element={<Login />} />
                <Route path="/reset/:token" element={<Login />} />
                <Route path="/verify/:token" element={<Login />} />
                <Route path="/403" element={<React.Suspense fallback={<Spinner />}><AccessDenied /></React.Suspense>} />
                <Route path="/404" element={<div>Page Not Found</div>} />
                <Route path="/500" element={<div>Server Error</div>} />
                <Route path="/maintenance" element={<div>Maintenance Mode</div>} />
                <Route path="/offline" element={<div>Offline</div>} />
                <Route path="/legal" element={<div>Legal</div>} />
                <Route path="/cookie-policy" element={<React.Suspense fallback={<Spinner />}><CookiePolicy /></React.Suspense>} />
                <Route path="/contact" element={<Contact />} />

                {/* ── Direct support chat route ── */}
                <Route path="/chat" element={<MessagesPage />} />

                {/* ── Callbacks route ── */}
                <Route path="/callbacks" element={<Callbacks />} />

                {/* ── Staff password setup ── */}
                <Route path="/staff/set-password" element={<SetPassword />} />

                {/* ── Admin entry ── */}
                <Route path="/admin/login" element={<Login />} />
                <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
                <Route path="/admin/force-password-change" element={<React.Suspense fallback={<Spinner />}><ForcePasswordChange /></React.Suspense>} />

                {/* ── Legacy admin routes (AdminLayout handles auth for all admin roles) ── */}
                <Route element={<AdminLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/services" element={<Services />} />
                  <Route path="/bookings" element={<Bookings />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/consultations" element={<Consultations />} />
                  <Route path="/revenue" element={<Revenue />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/staff-accounts" element={<DeptStaff />} />
                  <Route path="/admin/chat-control" element={<AdminChatControl />} />
                  <Route path="/admin/revenue" element={<AdminRevenueDashboard />} />
                </Route>

                {/* ── Super Admin ── */}
                <Route path="/admin/super" element={<AdminPrivateRoute><SuperAdminLayout /></AdminPrivateRoute>}>
                  <Route index element={<SuperDashboard />} />
                  <Route path="departments" element={<DepartmentsPage />} />
                  <Route path="devices" element={<DeviceManagement />} />
                  <Route path="users" element={<UserManagement />} />
                  <Route path="admin-allocation" element={<DepartmentAdminAllocation />} />
                  <Route path="manage-departments" element={<DepartmentManagement />} />
                  <Route path="dept-analytics" element={<DepartmentAnalytics />} />
                  <Route path="email" element={<EmailAllocationPage />} />
                  <Route path="finance" element={<FinancePage />} />
                  <Route path="payments" element={<PaymentHistory />} />
                  <Route path="tickets" element={<TicketsPage color="#ff3366" />} />
                  <Route path="inventory" element={<InventoryPage color="#EE6100" />} />
                  <Route path="audit" element={<AuditLogPage />} />
                  <Route path="broadcast" element={<BroadcastPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="chat" element={<MessagesPage />} />
                  <Route path="staff-invitation" element={<StaffInvitation color="#a78bfa" />} />                   <Route path="health" element={<React.Suspense fallback={<Spinner />}><HealthDashboard /></React.Suspense>} />
                   <Route path="blog" element={<React.Suspense fallback={<Spinner />}><BlogManagement /></React.Suspense>} />
                   <Route path="studio" element={<React.Suspense fallback={<Spinner />}><TechStudio /></React.Suspense>} />                    <Route path="meetings" element={<React.Suspense fallback={<Spinner />}><MeetingScheduler /></React.Suspense>} />
                    <Route path="monetization" element={<React.Suspense fallback={<Spinner />}><MonetizationDashboard /></React.Suspense>} />
                    <Route path="errors" element={<React.Suspense fallback={<Spinner />}><ErrorTracker /></React.Suspense>} />
                </Route>

                {/* ── Departments ── */}
                <Route path="/admin/internet" element={<DeptLayout slug="internet" title="Internet Distribution" />}>
                  <Route index element={<InternetLanding />} />
                  <Route path="clients" element={<ISPClients />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="crm" element={<CRMPage color="#2BB6A3" />} />
                  <Route path="billing" element={<BillingPage color="#2BB6A3" />} />
                  <Route path="inventory" element={<InventoryPage color="#2BB6A3" />} />
                  <Route path="tickets" element={<TicketsPage color="#2BB6A3" />} />
                  <Route path="staff-portal" element={<StaffPortalAdmin color="#2BB6A3" />} />
                  <Route path="staff" element={<StaffInvitation color="#2BB6A3" />} />
                  <Route path="expenses" element={<ExpensesPage />} />
                  <Route path="audit" element={<AuditLogPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="chat" element={<MessagesPage />} />
                  <Route path="staff-invitation" element={<StaffInvitation color="#2BB6A3" />} />
                </Route>

                <Route path="/admin/webdev" element={<DeptLayout slug="webdev" title="Web Development" />}>
                  <Route index element={<WebDevLanding />} />
                  <Route path="projects" element={<ProjectsPage />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="crm" element={<CRMPage color="#a78bfa" />} /> {/* Changed from Soon to CRMPage */}
                  <Route path="billing" element={<BillingPage color="#a78bfa" />} /> {/* Changed from Soon to BillingPage */}
                  <Route path="inventory" element={<InventoryPage color="#a78bfa" />} />
                  <Route path="tickets" element={<TicketsPage color="#a78bfa" />} />
                  <Route path="staff-portal" element={<StaffPortalAdmin color="#a78bfa" />} />
                  <Route path="staff" element={<StaffInvitation color="#a78bfa" />} />
                  <Route path="expenses" element={<ExpensesPage />} />
                  <Route path="audit" element={<AuditLogPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="chat" element={<MessagesPage />} />
                  <Route path="staff-invitation" element={<StaffInvitation color="#a78bfa" />} />
                </Route>

                <Route path="/admin/playstation" element={<DeptLayout slug="playstation" title="PlayStation Arena" />}>
                  <Route index element={<PlayStationLanding />} />
                  <Route path="sessions" element={<SessionsPage />} />

                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="crm" element={<CRMPage color="#ffd700" />} /> {/* Changed from Soon to CRMPage */}
                  <Route path="billing" element={<BillingPage color="#ffd700" />} /> {/* Changed from Soon to BillingPage */}
                  <Route path="inventory" element={<InventoryPage color="#ffd700" />} />
                  <Route path="tickets" element={<TicketsPage color="#ffd700" />} />
                  <Route path="staff-portal" element={<StaffPortalAdmin color="#ffd700" />} />
                  <Route path="staff" element={<StaffInvitation color="#ffd700" />} />
                  <Route path="expenses" element={<ExpensesPage />} />
                  <Route path="audit" element={<AuditLogPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="chat" element={<MessagesPage />} />
                  <Route path="staff-invitation" element={<StaffInvitation color="#ffd700" />} />
                </Route>

                <Route path="/admin/repair" element={<DeptLayout slug="repair" title="Hardware Repair" />}>
                  <Route index element={<RepairLanding />} />
                  <Route path="jobcards" element={<JobCards />} /> {/* Changed from Soon to JobCards */}
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="crm" element={<CRMPage color="#ff8800" />} /> {/* Changed from Soon to CRMPage */}
                  <Route path="billing" element={<BillingPage color="#ff8800" />} /> {/* Changed from Soon to BillingPage */}
                  <Route path="inventory" element={<InventoryPage color="#ff8800" />} />
                  <Route path="tickets" element={<TicketsPage color="#ff8800" />} />
                  <Route path="staff-portal" element={<StaffPortalAdmin color="#ff8800" />} />
                  <Route path="staff" element={<StaffInvitation color="#ff8800" />} />
                  <Route path="expenses" element={<ExpensesPage />} />
                  <Route path="audit" element={<AuditLogPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="chat" element={<MessagesPage />} />
                  <Route path="staff-invitation" element={<StaffInvitation color="#ff8800" />} />
                </Route>

                <Route path="/admin/cybersecurity" element={<DeptLayout slug="cybersecurity" title="Cybersecurity" />}>
                  <Route index element={<CybersecurityLanding />} />
                  <Route path="contracts" element={<SecurityContracts />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="crm" element={<CRMPage color="#ff3366" />} /> {/* Changed from Soon to CRMPage */}
                  <Route path="billing" element={<BillingPage color="#ff3366" />} /> {/* Changed from Soon to BillingPage */}
                  <Route path="inventory" element={<InventoryPage color="#ff3366" />} />
                  <Route path="tickets" element={<TicketsPage color="#ff3366" />} />
                  <Route path="staff-portal" element={<StaffPortalAdmin color="#ff3366" />} />
                  <Route path="staff" element={<StaffInvitation color="#ff3366" />} />
                  <Route path="expenses" element={<ExpensesPage />} />
                  <Route path="audit" element={<AuditLogPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="chat" element={<MessagesPage />} />
                  <Route path="staff-invitation" element={<StaffInvitation color="#ff3366" />} />
                </Route>

                <Route path="/admin/govadmin" element={<DeptLayout slug="govadmin" title="Gov Admin Assistance" />}>
                  <Route index element={<GovAdminLanding />} />
                  <Route path="govdocs" element={<GovDocs />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="crm" element={<CRMPage color="#00ff88" />} /> {/* Changed from Soon to CRMPage */}
                  <Route path="billing" element={<BillingPage color="#00ff88" />} /> {/* Changed from Soon to BillingPage */}
                  <Route path="inventory" element={<InventoryPage color="#00ff88" />} />
                  <Route path="tickets" element={<TicketsPage color="#00ff88" />} />
                  <Route path="staff-portal" element={<StaffPortalAdmin color="#00ff88" />} />
                  <Route path="staff" element={<StaffInvitation color="#00ff88" />} />
                  <Route path="expenses" element={<ExpensesPage />} />
                  <Route path="audit" element={<AuditLogPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="chat" element={<MessagesPage />} />
                  <Route path="staff-invitation" element={<StaffInvitation color="#00ff88" />} />
                </Route>

                {/* ── Dynamic Department Catch-All ── */}
                <Route path="/admin/:slug" element={<DynamicDeptRoute />}>
                  <Route index element={<DynamicDepartmentLanding />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="crm" element={<CRMPage color="#A9C4BE" />} />
                  <Route path="billing" element={<BillingPage color="#A9C4BE" />} />
                  <Route path="inventory" element={<InventoryPage color="#A9C4BE" />} />
                  <Route path="tickets" element={<TicketsPage color="#A9C4BE" />} />
                  <Route path="staff-portal" element={<StaffPortalAdmin color="#A9C4BE" />} />
                  <Route path="expenses" element={<ExpensesPage />} />
                  <Route path="audit" element={<AuditLogPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="chat" element={<MessagesPage />} />
                  <Route path="staff-invitation" element={<StaffInvitation color="#A9C4BE" />} />
                </Route>

                {/* ── Staff Portal ── */}
                <Route path="/staff/:slug/dashboard" element={<StaffDashboard />} />
                <Route path="/staff" element={<Navigate to="/login" replace />} />

                {/* ── Client Portal ── */}
                <Route path="/client/:slug" element={<ClientPortal />} />
                <Route path="/client" element={<Navigate to="/" replace />} />

                {/* ── Public store ── */}
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<RedirectToAppropriatePage />} />
                  <Route path="/store" element={<Store />} />
                  <Route path="/store/:slug" element={<ProductDetail />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/order-status" element={<OrderStatus />} />
                  <Route path="/receipt/:orderNumber" element={<ReceiptPage />} />
                  <Route path="/calculator" element={<Calculator />} />
                  <Route path="/consult" element={<ConsultLanding />} />
                  <Route path="/consult/book" element={<ConsultBook />} />
                  <Route path="/services" element={<PublicServices />} />
                  <Route path="/contact" element={<Contact />} />                   <Route path="/help" element={<HelpDesk />} />
                   <Route path="/tech-insights" element={<React.Suspense fallback={<Spinner />}><TechInsights /></React.Suspense>} />
                   <Route path="/tech-hub" element={<React.Suspense fallback={<Spinner />}><TechHubLocal /></React.Suspense>} />
                  <Route path="/track" element={<TrackTicket />} />
                  <Route path="/client/portal/:projectToken" element={<PublicWebPortal />} />
                </Route>
              </Routes></Suspense></PageTransition></ErrorBoundary>

              <ConditionalChatWidget />
              <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
              <CookieConsent />

      </BrowserRouter>
    </div>
  );
}