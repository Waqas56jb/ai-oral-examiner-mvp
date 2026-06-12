import { useEffect, useState } from 'react'
import { FiMenu, FiX } from 'react-icons/fi'
import { FaMicrophoneAlt } from 'react-icons/fa'
import Button from '../../common/Button/Button'
import useScrollPosition from '../../../hooks/useScrollPosition'
import { navLinks } from '../../../data/navigation'
import './Header.css'

export default function Header() {
  const scrolled = useScrollPosition(30)
  const [open, setOpen] = useState(false)

  // Lock body scroll when the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <header className={`header ${scrolled ? 'header--scrolled' : ''}`}>
      <div className="container header__inner">
        <a href="#top" className="header__logo" onClick={close}>
          <span className="header__logo-badge">
            <FaMicrophoneAlt />
          </span>
          <span className="header__logo-text">
            Pass<span>GP</span>
          </span>
        </a>

        <nav className="header__nav" aria-label="Primary">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="header__link">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="header__actions">
          <a href="#cta" className="header__signin">
            Sign in
          </a>
          <Button as="a" href="#demo" size="sm" variant="primary">
            Try the demo
          </Button>
        </div>

        <button
          className="header__burger"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <FiX /> : <FiMenu />}
        </button>
      </div>

      {/* Mobile menu */}
      <div className={`mobile-menu ${open ? 'is-open' : ''}`}>
        <nav className="mobile-menu__nav">
          {navLinks.map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              className="mobile-menu__link"
              style={{ transitionDelay: `${0.05 * i + 0.05}s` }}
              onClick={close}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="mobile-menu__actions">
          <Button as="a" href="#cta" variant="secondary" full onClick={close}>
            Sign in
          </Button>
          <Button as="a" href="#demo" variant="primary" full onClick={close}>
            Try the demo
          </Button>
        </div>
      </div>
      <div
        className={`mobile-menu__backdrop ${open ? 'is-open' : ''}`}
        onClick={close}
      />
    </header>
  )
}
