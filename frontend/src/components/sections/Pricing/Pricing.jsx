import { FiCheck } from 'react-icons/fi'
import SectionHeading from '../../common/SectionHeading/SectionHeading'
import Reveal from '../../common/Reveal/Reveal'
import Button from '../../common/Button/Button'
import { pricing } from '../../../data/pricing'
import './Pricing.css'

export default function Pricing() {
  return (
    <section className="section section--soft pricing" id="pricing">
      <div className="container">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple plans that grow with you"
          subtitle="Start free with the MVP preview, then scale up as your exam approaches — or roll it out across your whole cohort."
        />

        <div className="pricing__grid">
          {pricing.map((plan, i) => (
            <Reveal
              key={plan.name}
              className={`price-card ${plan.featured ? 'price-card--featured' : ''}`}
              delay={i * 100}
            >
              {plan.featured && <span className="price-card__ribbon">Most popular</span>}
              <h3 className="price-card__name">{plan.name}</h3>
              <p className="price-card__desc">{plan.description}</p>
              <div className="price-card__price">
                <span className="price-card__amount">{plan.price}</span>
                <span className="price-card__period">{plan.period}</span>
              </div>
              <Button
                as="a"
                href="#cta"
                variant={plan.featured ? 'primary' : 'secondary'}
                full
              >
                {plan.cta}
              </Button>
              <ul className="price-card__features">
                {plan.features.map((f) => (
                  <li key={f}>
                    <FiCheck /> {f}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
