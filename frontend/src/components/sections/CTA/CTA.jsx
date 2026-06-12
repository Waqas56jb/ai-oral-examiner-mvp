import { FiArrowRight } from 'react-icons/fi'
import { FaMicrophoneAlt } from 'react-icons/fa'
import Reveal from '../../common/Reveal/Reveal'
import Button from '../../common/Button/Button'
import './CTA.css'

export default function CTA() {
  return (
    <section className="section cta" id="cta">
      <div className="container">
        <Reveal className="cta__card" y={40}>
          <div className="cta__bg" aria-hidden="true">
            <span className="cta__blob cta__blob--1" />
            <span className="cta__blob cta__blob--2" />
          </div>

          <div className="cta__content">
            <span className="cta__badge">
              <FaMicrophoneAlt /> Ready when you are
            </span>
            <h2 className="cta__title">
              Start practising your oral exam out loud — today
            </h2>
            <p className="cta__lead">
              Join the candidates building real spoken confidence with an AI examiner
              that listens, responds and helps you improve every single session.
            </p>
            <div className="cta__actions">
              <Button as="a" href="#demo" variant="light" size="lg" icon={<FiArrowRight />}>
                Try the live demo
              </Button>
              <Button as="a" href="#pricing" variant="gold" size="lg">
                See pricing
              </Button>
            </div>
            <p className="cta__note">No credit card required · MVP preview available now</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
