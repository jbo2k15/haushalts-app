import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { ZoomProvider } from './context/ZoomContext.jsx'
import { ModalGateProvider, useModalGate } from './context/ModalGateContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import ReleaseNotesModal from './components/ReleaseNotesModal.jsx'
import Login from './pages/Login.jsx'
import PageCarousel from './components/PageCarousel.jsx'

const Register = lazy(() => import('./pages/Register.jsx'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'))
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const ChangePassword = lazy(() => import('./pages/ChangePassword.jsx'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Laden…</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.mustChangePassword && window.location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function VersionFooter() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <p className="fixed bottom-0 inset-x-0 text-center text-[10px] text-gray-300 dark:text-gray-600 py-1 pointer-events-none z-10">
      v{__APP_VERSION__}
    </p>
  )
}

function ReleaseNotesGate() {
  const { user } = useAuth()
  if (!user || user.mustChangePassword) return null
  return <ReleaseNotesModal />
}

function AppRoutes() {
  const { releaseNotesOpen } = useModalGate()
  return (
    <Suspense fallback={<PageFallback />}>
      {/* inert while the release notes modal is up (see ReleaseNotesGate
          below) - traps focus/pointer interaction inside the modal instead
          of letting Tab or a stray tap reach the page underneath. */}
      <div inert={releaseNotesOpen}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
          {/* Home and Hall of Fame are swipeable slides of the same carousel -
              both routes render it so direct navigation/bookmarks to either
              URL still work, PageCarousel itself decides which slide is active. */}
          <Route path="/" element={<ProtectedRoute><PageCarousel /></ProtectedRoute>} />
          <Route path="/hall-of-fame" element={<ProtectedRoute><PageCarousel /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <VersionFooter />
      </div>
      <ReleaseNotesGate />
    </Suspense>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ZoomProvider>
          <AuthProvider>
            <ModalGateProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AppRoutes />
              </BrowserRouter>
            </ModalGateProvider>
          </AuthProvider>
        </ZoomProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
