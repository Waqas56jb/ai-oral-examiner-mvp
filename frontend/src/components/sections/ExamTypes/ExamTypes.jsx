import { FiArrowRight } from 'react-icons/fi'
import SectionHeading from '../../common/SectionHeading/SectionHeading'
import Reveal from '../../common/Reveal/Reveal'
import { examTypes } from '../../../data/examTypes'
import './ExamTypes.css'

export default function ExamTypes() {
  return (
    <section className="section exams" id="exams">
      <div className="container">
        <SectionHeading
          eyebrow="Exam pathways"
          title="Rehearse for the exam that matters to you"
          subtitle="The MVP launches with one sample clinical case, and the same foundation scales to every pathway and thousands of questions."
        />

        <div className="exams__grid">
          {examTypes.map((exam, i) => (
            <Reveal
              key={exam.code}
              className="exam-card"
              delay={i * 90}
              style={{ '--exam-color': exam.color }}
            >
              <div className="exam-card__head">
                <span className="exam-card__code">{exam.code}</span>
                <span className="exam-card__pill" />
              </div>
              <h3 className="exam-card__name">{exam.name}</h3>
              <p className="exam-card__text">{exam.text}</p>
              <div className="exam-card__tags">
                {exam.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              <a href="#demo" className="exam-card__link">
                Practise now <FiArrowRight />
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
