import { FaArrowUp } from 'react-icons/fa'
import useScrollPosition from '../../../hooks/useScrollPosition'
import './BackToTop.css'

export default function BackToTop() {
  const visible = useScrollPosition(500)

  const scrollTop = () =>
    window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <button
      className={`back-to-top ${visible ? 'is-visible' : ''}`}
      onClick={scrollTop}
      aria-label="Back to top"
    >
      <FaArrowUp />
    </button>
  )
}
