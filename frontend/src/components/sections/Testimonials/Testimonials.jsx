import { FaStar, FaQuoteRight } from 'react-icons/fa'
import SectionHeading from '../../common/SectionHeading/SectionHeading'
import Reveal from '../../common/Reveal/Reveal'
import { testimonials } from '../../../data/testimonials'
import './Testimonials.css'

export default function Testimonials() {
  return (
    <section className="section testimonials" id="testimonials">
      <div className="container">
        <SectionHeading
          eyebrow="Loved by candidates"
          title="Real practice, real confidence, real results"
          subtitle="Hear from the doctors using spoken AI practice to walk into their oral exams ready."
        />

        <div className="testimonials__grid">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} className="t-card" delay={i * 110}>
              <FaQuoteRight className="t-card__quote" />
              <div className="t-card__stars">
                {Array.from({ length: t.rating }).map((_, s) => (
                  <FaStar key={s} />
                ))}
              </div>
              <p className="t-card__text">{t.quote}</p>
              <div className="t-card__author">
                <img src={t.avatar} alt={t.name} />
                <div>
                  <strong>{t.name}</strong>
                  <small>{t.role}</small>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
