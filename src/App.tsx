import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider, useStore } from './store'
import type { UserRole } from './types'
import Layout from './components/Layout'
import ChangePasswordPage from './pages/ChangePasswordPage'
import Dashboard from './pages/Dashboard'
import EvaluationResults from './pages/EvaluationResults'
import LoginPage from './pages/LoginPage'
import ReviewCenter from './pages/ReviewCenter'
import ScholarshipConfig from './pages/ScholarshipConfig'
import StudentManagement from './pages/StudentManagement'
import StudentPortal from './pages/StudentPortal'

function RequireAuth() {
  const { currentUser } = useStore()
  const location = useLocation()

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (currentUser.role === 'student' && currentUser.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  return <Layout />
}

function RoleRoute({ role, children }: { role: UserRole; children: React.ReactElement }) {
  const { currentUser } = useStore()
  if (currentUser?.role !== role) {
    return <Navigate to={currentUser?.role === 'student' ? '/submit' : '/'} replace />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="change-password" element={<ChangePasswordPage />} />
            <Route index element={<RoleRoute role="admin"><Dashboard /></RoleRoute>} />
            <Route path="submit" element={<RoleRoute role="student"><StudentPortal /></RoleRoute>} />
            <Route path="users" element={<RoleRoute role="admin"><StudentManagement /></RoleRoute>} />
            <Route path="rules" element={<RoleRoute role="admin"><ScholarshipConfig /></RoleRoute>} />
            <Route path="review" element={<RoleRoute role="admin"><ReviewCenter /></RoleRoute>} />
            <Route path="results" element={<RoleRoute role="admin"><EvaluationResults /></RoleRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  )
}
