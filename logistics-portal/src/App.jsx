import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RequireAuth, RequireAdmin } from './components/ProtectedRoute'

import Login from './pages/Login'
import SignUp from './pages/SignUp'
import VerifyPhone from './pages/VerifyPhone'
import Dashboard from './pages/Dashboard'
import BatchList from './pages/BatchList'
import NewBatch from './pages/NewBatch'
import BatchDetail from './pages/BatchDetail'
import PackingLists from './pages/PackingLists'
import Account from './pages/Account'

import AdminOverview from './pages/admin/AdminOverview'
import AdminCustomers from './pages/admin/AdminCustomers'
import AdminCustomerDetail from './pages/admin/AdminCustomerDetail'
import AdminBatches from './pages/admin/AdminBatches'
import AdminBatchDetail from './pages/admin/AdminBatchDetail'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/verify-phone" element={<VerifyPhone />} />

          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/batches" element={<RequireAuth><BatchList /></RequireAuth>} />
          <Route path="/batches/new" element={<RequireAuth><NewBatch /></RequireAuth>} />
          <Route path="/batches/:id" element={<RequireAuth><BatchDetail /></RequireAuth>} />
          <Route path="/packing-lists" element={<RequireAuth><PackingLists /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />

          <Route path="/admin" element={<RequireAdmin><AdminOverview /></RequireAdmin>} />
          <Route path="/admin/customers" element={<RequireAdmin><AdminCustomers /></RequireAdmin>} />
          <Route path="/admin/customers/:id" element={<RequireAdmin><AdminCustomerDetail /></RequireAdmin>} />
          <Route path="/admin/batches" element={<RequireAdmin><AdminBatches /></RequireAdmin>} />
          <Route path="/admin/batches/:id" element={<RequireAdmin><AdminBatchDetail /></RequireAdmin>} />
          <Route path="/admin/packing-lists" element={<RequireAdmin><AdminBatches /></RequireAdmin>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
