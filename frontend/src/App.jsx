import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { SettingsProvider } from './hooks/useSettings';
import { ThemeProvider } from './theme/ThemeProvider';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MasterSettings from './pages/MasterSettings';
import Products from './pages/Products';
import POS from './pages/POS';
import Customers from './pages/Customers';
import Collection from './pages/Collection';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Inventory from './pages/Inventory';
import Expenses from './pages/Expenses';
import Income from './pages/Income';
import InvoicePrint from './pages/InvoicePrint';
import Invoices from './pages/Invoices';
import Reports from './pages/Reports';
import MasterData from './pages/MasterData';
import Users from './pages/Users';
import RolesPermissions from './pages/RolesPermissions';
import AuditLog from './pages/AuditLog';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/invoices/:id/print" element={<ProtectedRoute><InvoicePrint /></ProtectedRoute>} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="pos" element={<POS />} />
                <Route path="products" element={<Products />} />
                <Route path="invoices" element={<Invoices />} />
                <Route path="customers" element={<Customers />} />
                <Route path="collection" element={<Collection />} />
                <Route path="collections" element={<Collection />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="purchases" element={<Purchases />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="income" element={<Income />} />
                <Route path="reports" element={<Reports />} />
                <Route path="master-data" element={<MasterData />} />
                <Route path="users" element={<Users />} />
                <Route path="users/roles" element={<RolesPermissions />} />
                <Route path="audit-log" element={<AuditLog />} />
                <Route path="settings" element={<MasterSettings />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
