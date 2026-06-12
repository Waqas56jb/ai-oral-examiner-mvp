import SectionHeading from '../../common/SectionHeading/SectionHeading'
import Reveal from '../../common/Reveal/Reveal'
import { features } from '../../../data/features'
import './Features.css'

export default function Features() {
  return (
    <section className="section features" id="features">
      <div className="container">
        <SectionHeading
          eyebrow="Everything you need"
          title="A complete oral exam rehearsal, in one place"
          subtitle="From the first spoken word to your final feedback report, PassGP handles the whole experience — fast, secure and true to the real exam."
        />

        <div className="features__grid">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <Reveal
                key={f.title}
                className={`feature-card feature-card--${f.accent}`}
                delay={i * 80}
              >
                <div className="feature-card__icon">
                  <Icon />
                </div>
                <h3 className="feature-card__title">{f.title}</h3>
                <p className="feature-card__text">{f.text}</p>
                <span className="feature-card__glow" aria-hidden="true" />
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
