import { Suspense, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './auth'

const ICONS = {
  overview: (
    <path d="M3 13h4v5H3zM8.5 8h4v10h-4zM14 3h4v15h-4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  ),
  history: (
    <>
      <rect x="2.5" y="3.5" width="16" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 8h16M7 2v3M14 2v3M6.5 12h3M6.5 15h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  locations: (
    <>
      <path d="M10.5 19s6-5.2 6-10a6 6 0 10-12 0c0 4.8 6 10 6 10z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10.5" cy="9" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  team: (
    <>
      <circle cx="8" cy="7.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 18c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8M14 4.8a3 3 0 010 5.4M16 13.6c1.5.7 2.4 2.2 2.7 4.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
}

const NAV = [
  { to: '/', label: 'Overview', icon: ICONS.overview, end: true, admin: false },
  { to: '/history', label: 'History', icon: ICONS.history, end: false, admin: false },
  { to: '/locations', label: 'Branches', icon: ICONS.locations, end: false, admin: false },
  { to: '/team', label: 'Team', icon: ICONS.team, end: false, admin: true },
]

export function Logo() {
  return (
    <span className="logo">
      <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#0f6e66" />
        <circle cx="23.5" cy="26" r="3.6" fill="#fff" />
        <circle cx="40.5" cy="26" r="3.6" fill="#fff" />
        <path d="M20 38.5c3.5 5 8 7.5 12 7.5s8.5-2.5 12-7.5" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
      </svg>
      <span className="logo-word" translate="no">Aftertaste</span>
    </span>
  )
}

export function Shell() {
  const { me, isAdmin, logout } = useAuth()
  const items = NAV.filter((n) => !n.admin || isAdmin)

  useEffect(() => {
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
  }, [])

  return (
    <div className="shell min-h-screen">
      <aside className="sidebar">
        <Logo />
        <nav aria-label="Main">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="side-link">
              <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden>
                {n.icon}
              </svg>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="who">
            <span className="avatar" aria-hidden>
              {me?.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="who-text">
              <span className="who-name">{me?.name}</span>
              <span className="who-role">{isAdmin ? 'Admin' : 'Branch manager'}</span>
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <header className="topbar">
        <Logo />
        <button className="btn btn-ghost btn-sm" onClick={logout}>
          Sign out
        </button>
      </header>

      <main className="main">
        <Suspense
          fallback={
            <div className="page">
              <div className="skeleton" style={{ height: 36, width: 220 }} />
              <div className="skeleton" style={{ height: 300, marginTop: 24 }} />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      <nav className="tabbar" aria-label="Main">
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="tab">
            <svg width="22" height="22" viewBox="0 0 21 21" aria-hidden>
              {n.icon}
            </svg>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
