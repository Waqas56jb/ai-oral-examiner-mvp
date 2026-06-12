import './TrustBar.css'

const bodies = ['RACGP', 'ACRRM', 'AMC', 'PESCI', 'RCGP', 'MRCGP', 'Kajabi', 'Jotform']

export default function TrustBar() {
  // Duplicate the list so the marquee loops seamlessly
  const loop = [...bodies, ...bodies]

  return (
    <section className="trustbar">
      <div className="container">
        <p className="trustbar__label">
          Built for the exams and platforms medical educators already trust
        </p>
      </div>
      <div className="trustbar__marquee">
        <div className="trustbar__track">
          {loop.map((name, i) => (
            <span className="trustbar__item" key={`${name}-${i}`}>
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
