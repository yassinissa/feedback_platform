import { Suspense, lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { SWRConfig } from 'swr'
import { fetcher } from '../lib/api'
import '../styles/admin.css'
import { ToastProvider } from '../ui/Toast'
import { AuthProvider, useAuth } from './auth'
import { Shell } from './Shell'

const Overview = lazy(() => import('./Overview'))
const History = lazy(() => import('./History'))
const Locations = lazy(() => import('./Locations'))
const Team = lazy(() => import('./Team'))
const Login = lazy(() => import('./Login'))

function PageFallback() {
  return (
    <div className="page">
      <div className="skeleton" style={{ height: 36, width: 220 }} />
      <div className="skeleton" style={{ height: 120, marginTop: 24 }} />
      <div className="skeleton" style={{ height: 280, marginTop: 16 }} />
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { me, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <PageFallback />
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  return <>{children}</>
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />
}

export default function AdminApp() {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true, keepPreviousData: true, dedupingInterval: 4000 }}>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                element={
                  <RequireAuth>
                    <Shell />
                  </RequireAuth>
                }
              >
                <Route index element={<Overview />} />
                <Route path="history" element={<History />} />
                <Route path="locations" element={<Locations />} />
                <Route
                  path="team"
                  element={
                    <AdminOnly>
                      <Team />
                    </AdminOnly>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </SWRConfig>
  )
}
