import { useState } from 'react'
import { FiPlus } from 'react-icons/fi'
import SectionHeading from '../../common/SectionHeading/SectionHeading'
import Reveal from '../../common/Reveal/Reveal'
import { faqs } from '../../../data/faqs'
import './FAQ.css'

export default function FAQ() {
  const [open, setOpen] = useState(0)

  return (
    <section className="section faq" id="faq">
      <div className="container container--narrow">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions, answered"
          subtitle="Everything you need to know about PassGP and the AI voice examiner."
        />

        <div className="faq__list">
          {faqs.map((item, i) => {
            const isOpen = open === i
            return (
              <Reveal
                key={item.q}
                className={`faq-item ${isOpen ? 'is-open' : ''}`}
                delay={i * 60}
              >
                <button
                  className="faq-item__q"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                >
                  <span>{item.q}</span>
                  <span className="faq-item__icon">
                    <FiPlus />
                  </span>
                </button>
                <div className="faq-item__a">
                  <div className="faq-item__a-inner">
                    <p>{item.a}</p>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
