import Reveal from '../Reveal/Reveal'
import './SectionHeading.css'

/**
 * Standard centered (or left) section heading block.
 * Props: eyebrow, title, subtitle, align ('center' | 'left'), light
 */
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  light = false,
}) {
  return (
    <div className={`sec-heading sec-heading--${align} ${light ? 'sec-heading--light' : ''}`}>
      {eyebrow && (
        <Reveal as="span" className="eyebrow" y={16}>
          {eyebrow}
        </Reveal>
      )}
      {title && (
        <Reveal as="h2" className="sec-heading__title" delay={80} y={20}>
          {title}
        </Reveal>
      )}
      {subtitle && (
        <Reveal as="p" className="sec-heading__subtitle" delay={160} y={20}>
          {subtitle}
        </Reveal>
      )}
    </div>
  )
}
