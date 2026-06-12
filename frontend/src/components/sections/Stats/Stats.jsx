import StatItem from './StatItem'
import { stats } from '../../../data/stats'
import './Stats.css'

export default function Stats() {
  return (
    <section className="stats section--navy">
      <div className="stats__bg" aria-hidden="true" />
      <div className="container">
        <div className="stats__grid">
          {stats.map((s) => (
            <StatItem key={s.label} {...s} />
          ))}
        </div>
      </div>
    </section>
  )
}
