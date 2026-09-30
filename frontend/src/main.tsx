import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './styles/base.css'

// Guest iPads only ever download the guest bundle; the admin app is a separate chunk.
const GuestApp = lazy(() => import('./guest/GuestApp'))
const AdminApp = lazy(() => import('./admin/AdminApp'))

function Boot() {
  return (
    <div className="min-h-screen" style={{ display: 'grid', placeItems: 'center' }}>
      <span className="spinner" aria-label="Loading" />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<Boot />}>
        <Routes>
          <Route path="/f/:slug" element={<GuestApp />} />
          <Route path="/*" element={<AdminApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
