import SectionHeading from '../../common/SectionHeading/SectionHeading'
import Reveal from '../../common/Reveal/Reveal'
import { steps } from '../../../data/steps'
import './HowItWorks.css'

export default function HowItWorks() {
  return (
    <section className="section section--soft how" id="how-it-works">
      <div className="container">
        <SectionHeading
          eyebrow="How it works"
          title="From hello to feedback in four simple steps"
          subtitle="No installs, no scheduling, no study partner required. Just open the app and start talking."
        />

        <div className="how__grid">
          <div className="how__line" aria-hidden="true" />
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <Reveal key={step.number} className="how__step" delay={i * 120}>
                <div className="how__step-top">
                  <span className="how__number">{step.number}</span>
                  <div className="how__icon">
                    <Icon />
                  </div>
                </div>
                <h3 className="how__title">{step.title}</h3>
                <p className="how__text">{step.text}</p>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
