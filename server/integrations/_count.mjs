import 'dotenv/config'
const KEY = process.env.JOTFORM_API_KEY
const BASE = 'https://passgp.jotform.com/API'

async function page(offset, limit = 1000) {
  const url = `${BASE}/user/forms?limit=${limit}&offset=${offset}&apiKey=${KEY}`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  const j = await r.json()
  return j.content || []
}

let offset = 0
let all = []
while (true) {
  const batch = await page(offset, 1000)
  all = all.concat(batch)
  process.stdout.write(`fetched ${all.length}... `)
  if (batch.length < 1000) break
  offset += 1000
  if (offset > 20000) break
}
console.log('\n\nTOTAL forms:', all.length)
const active = all.filter((f) => f.status !== 'DELETED')
console.log('Active (non-deleted):', active.length)

const caseRe = /case\s*[a-z]?\d/i
const matched = active.filter((f) => caseRe.test(f.title))
console.log('Match /case\\s*[a-z]?\\d/i:', matched.length)

const hasCaseWord = active.filter((f) => /case/i.test(f.title))
console.log('Has word "case":', hasCaseWord.length)

console.log('\nSample titles that have "case" but DID NOT match the strict regex:')
hasCaseWord.filter((f) => !caseRe.test(f.title)).slice(0, 15).forEach((f) => console.log('  -', f.title))

console.log('\nSample of ALL active titles:')
active.slice(0, 25).forEach((f) => console.log('  -', f.title))
