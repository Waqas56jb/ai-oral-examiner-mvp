import Reveal from '../../common/Reveal/Reveal'
import { benefits } from '../../../data/benefits'
import './Benefits.css'

const BENEFIT_IMG =
  'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80'

export default function Benefits() {
  return (
    <section className="section section--soft benefits" id="benefits">
      <div className="container benefits__inner">
        {/* Image side */}
        <Reveal className="benefits__visual" y={40}>
          <div className="benefits__img-wrap">
            <img src={BENEFIT_IMG} alt="Doctor preparing for a medical exam" />
          </div>
          <div className="benefits__float">
            <div className="benefits__float-bar">
              <span style={{ width: '88%' }} />
            </div>
            <div className="benefits__float-text">
              <strong>Confidence score</strong>
              <small>+34% after 5 sessions</small>
            </div>
          </div>
          <div className="benefits__dots" aria-hidden="true" />
        </Reveal>

        {/* Copy side */}
        <div className="benefits__copy">
          <Reveal as="span" className="eyebrow">
            Why candidates love it
          </Reveal>
          <Reveal as="h2" className="benefits__title" delay={80}>
            Built to turn exam anxiety into exam confidence
          </Reveal>
          <Reveal as="p" className="benefits__lead" delay={140}>
            Reading notes can only take you so far. Real oral exams reward fluent,
            spoken reasoning under pressure — and that is exactly what PassGP helps
            you build, one realistic case at a time.
          </Reveal>

          <div className="benefits__list">
            {benefits.map((b, i) => {
              const Icon = b.icon
              return (
                <Reveal key={b.title} className="benefit-item" delay={i * 90}>
                  <div className="benefit-item__icon">
                    <Icon />
                  </div>
                  <div>
                    <h3>{b.title}</h3>
                    <p>{b.text}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
