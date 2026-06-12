import { FaMicrophoneAlt, FaTwitter, FaLinkedinIn, FaFacebookF, FaInstagram } from 'react-icons/fa'
import { FiArrowRight } from 'react-icons/fi'
import { footerColumns } from '../../../data/footer'
import './Footer.css'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__top">
          {/* Brand + newsletter */}
          <div className="footer__brand">
            <a href="#top" className="footer__logo">
              <span className="footer__logo-badge">
                <FaMicrophoneAlt />
              </span>
              <span className="footer__logo-text">
                Pass<span>GP</span>
              </span>
            </a>
            <p className="footer__tagline">
              The AI voice oral examiner helping medical candidates rehearse,
              refine and pass — one spoken case at a time.
            </p>

            <form className="footer__news" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="news" className="sr-only">
                Email address
              </label>
              <input
                id="news"
                type="email"
                placeholder="Enter your email"
                className="footer__news-input"
              />
              <button type="submit" className="footer__news-btn" aria-label="Subscribe">
                <FiArrowRight />
              </button>
            </form>

            <div className="footer__socials">
              <a href="#" aria-label="Twitter"><FaTwitter /></a>
              <a href="#" aria-label="LinkedIn"><FaLinkedinIn /></a>
              <a href="#" aria-label="Facebook"><FaFacebookF /></a>
              <a href="#" aria-label="Instagram"><FaInstagram /></a>
            </div>
          </div>

          {/* Link columns */}
          <div className="footer__links">
            {footerColumns.map((col) => (
              <div key={col.title} className="footer__col">
                <h4 className="footer__col-title">{col.title}</h4>
                <ul>
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="footer__bottom">
          <p>© {year} PassGP. All rights reserved.</p>
          <div className="footer__legal">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
