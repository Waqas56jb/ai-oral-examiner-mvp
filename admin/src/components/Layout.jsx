import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { FiMenu, FiBell, FiLogOut, FiSearch } from 'react-icons/fi'
import { FaMicrophoneAlt } from 'react-icons/fa'
import { navGroups, pageMeta } from '../data/nav'
import { useAuth } from '../context/AuthContext'
import { initials } from '../lib/format'

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { admin, session, signOut } = useAuth()
  const { pathname } = useLocation()
  const meta = pageMeta[pathname] || { title: 'Admin', sub: '' }
  const email = admin?.email || session?.user?.email || ''

  return (
    <div className="shell">
      {/* Sidebar */}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar__brand">
          <div className="sidebar__logo">
            <FaMicrophoneAlt />
          </div>
          <div>
            <div className="sidebar__brand-text">
              Pass<span>GP</span>
            </div>
            <div className="sidebar__brand-sub">Admin Console</div>
          </div>
        </div>

        <nav className="sidebar__nav">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="sidebar__group-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  <item.icon />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__foot">
          <div className="sidebar__user">
            <div className="sidebar__avatar">{initials(admin?.full_name, email)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar__user-name">{admin?.full_name || 'Administrator'}</div>
              <div className="sidebar__user-role" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email}
              </div>
            </div>
            <button className="sidebar__logout" onClick={signOut} title="Sign out">
              <FiLogOut />
            </button>
          </div>
        </div>
      </aside>
      <div className={`sidebar__backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <button className="topbar__burger" onClick={() => setOpen(true)}>
            <FiMenu />
          </button>
          <div className="topbar__title">
            <h1>{meta.title}</h1>
            <p>{meta.sub}</p>
          </div>
          <div className="topbar__spacer" />
          <div className="topbar__search">
            <FiSearch />
            <input placeholder="Search anything…" />
          </div>
          <button className="topbar__icon-btn">
            <FiBell />
            <span className="topbar__dot" />
          </button>
        </header>

        <main className="content">
          <div className="page-enter" key={pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
