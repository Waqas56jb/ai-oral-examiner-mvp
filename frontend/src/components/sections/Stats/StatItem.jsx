import useCountUp from '../../../hooks/useCountUp'

export default function StatItem({ value, suffix, label }) {
  const [count, ref] = useCountUp(value, { duration: 2000 })

  return (
    <div className="stats__item" ref={ref}>
      <div className="stats__value">
        {count.toLocaleString()}
        <span className="stats__suffix">{suffix}</span>
      </div>
      <p className="stats__label">{label}</p>
    </div>
  )
}
