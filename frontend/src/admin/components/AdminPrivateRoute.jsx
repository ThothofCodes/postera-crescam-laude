// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

const ADMIN_ROLES = ['SUPER_ADMIN', 'SITE_MANAGER', 'DEPT_HEAD_OWNER', 'STAFF', 'admin', 'staff'];

const AdminPrivateRoute = ({ children }) => {
  const { user, loading } = useAdminAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Allow access if user is authenticated with any admin role
  if (ADMIN_ROLES.includes(user.role)) {
    // Force password change on first login
    if (user.mustChangePassword) {
      return <Navigate to="/admin/force-password-change" replace />;
    }
    return children;
  }

  // Access denied for non-admin users
  return <Navigate to="/403" replace />;
};

export default AdminPrivateRoute;