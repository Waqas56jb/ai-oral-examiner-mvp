import 'dotenv/config'
import { supabase } from './supabase.js'

/**
 * Clean up duplicate / inconsistently-named categories (exam_type).
 *   npm run normalize:categories
 * Merges typos and variants into canonical names. Idempotent.
 */

const TYPOS = [
  [/cardiolovascular/i, 'Cardiovascular'],
  [/materal/i, 'Maternal'],
  [/pstchology/i, 'Psychology'],
  [/respirtory/i, 'Respiratory'],
  [/muscloskeletal/i, 'Musculoskeletal'],
  [/obststrics/i, 'Obstetrics'],
  [/gynaecoloic/i, 'Gynaecological'],
  [/reproducrive/i, 'Reproductive'],
  [/endocinology/i, 'Endocrinology'],
  [/disabiity/i, 'Disability'],
]

// lowercased (normalized) -> canonical
const CANON = {
  'cardiology': 'Cardiovascular',
  'cardiovascular': 'Cardiovascular',
  'gastrointestinal': 'Gastroenterology',
  'gastroenterology': 'Gastroenterology',
  'neurological': 'Neurology',
  'neurology': 'Neurology',
  'haematological': 'Haematology',
  'haematology': 'Haematology',
  'pediatrics': 'Paediatrics',
  'paediatrics': 'Paediatrics',
  'psychological': 'Psychology',
  'psychology': 'Psychology',
  'endocrine': 'Endocrinology',
  'endocrinology': 'Endocrinology',
  'obststrics': 'Obstetrics',
  'obstetrics': 'Obstetrics',
  'respiratory': 'Respiratory',
  'gyanecological': 'Gynaecology',
  'gynaecologic': 'Gynaecology',
  'gynaecological': 'Gynaecology',
  'gynaecology': 'Gynaecology',
  'general gynaecology': 'Gynaecology',
  'gynaecologic oncology': 'Gynaecological Oncology',
  'gynaecological oncology': 'Gynaecological Oncology',
  'gynaecology oncology': 'Gynaecological Oncology',
  'reproductive endocrinology': 'Reproductive Endocrinology & Infertility',
  'reproductive endocrinology & infertility': 'Reproductive Endocrinology & Infertility',
  'reproductive endocrinology and infertility': 'Reproductive Endocrinology & Infertility',
  'reproductive health & endocrinology': 'Reproductive Endocrinology & Infertility',
  'sexual health': 'Sexual & Reproductive Health',
  'sexual and reproductive health': 'Sexual & Reproductive Health',
  'maternal fetal medicine': 'Maternal-Fetal Medicine',
  'maternal-fetal medicine': 'Maternal-Fetal Medicine',
  'ear nose and throat': 'Ear, Nose and Throat',
  'ear, nose and throat': 'Ear, Nose and Throat',
  'general obstetrics': 'Obstetrics',
  'preventive medicine': 'Preventive Medicine',
  'population and prevention': 'Population and Preventive Health',
  'population and preventive health': 'Population and Preventive Health',
  'organisational and legal': 'Organisational and Legal',
  'organisational and legal dimensions': 'Organisational and Legal',
  'disability/ genetics': 'Disability/Genetics',
  'disability /genetics': 'Disability/Genetics',
  'disability/genetics': 'Disability/Genetics',
  'pediatrics': 'Paediatrics',
  'sexual and reproducrive health': 'Sexual & Reproductive Health',
}

async function fetchAllExamTypes() {
  const out = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from('exam_questions').select('exam_type').range(from, from + 999)
    if (error || !data?.length) break
    out.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return out
}

function canonical(raw) {
  if (!raw) return raw
  let s = String(raw).trim().replace(/[‐-―−]/g, '-').replace(/\s+/g, ' ')
  for (const [re, rep] of TYPOS) s = s.replace(re, rep)
  const key = s.toLowerCase()
  return CANON[key] || s
}

async function main() {
  console.log('\nPassGP — normalize categories')
  console.log('──────────────────────────────')

  // distinct current categories (paginated — covers ALL rows, not just 1000)
  const all = await fetchAllExamTypes()
  const distinct = [...new Set(all.map((r) => r.exam_type).filter(Boolean))]
  console.log(`  Scanned ${all.length} rows · ${distinct.length} distinct categories`)

  let changed = 0
  for (const cat of distinct) {
    const canon = canonical(cat)
    if (canon !== cat) {
      const { error } = await supabase.from('exam_questions').update({ exam_type: canon }).eq('exam_type', cat)
      if (!error) {
        changed++
        console.log(`    "${cat}"  ->  "${canon}"`)
      }
    }
  }

  const after = await fetchAllExamTypes()
  const distinctAfter = new Set(after.map((r) => r.exam_type).filter(Boolean))
  console.log(`\n  ✓ Merged ${changed} variant(s). Distinct categories: ${distinct.length} -> ${distinctAfter.size}\n`)
}

main().catch((e) => {
  console.log('  ✗ Error:', e.message)
  process.exit(1)
})
