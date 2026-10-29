import fs from 'node:fs';

const QLOO_API_KEY = 'hack_79608ef0cbb3f7d7c60a9d6dee03ac2d6cf6deef';
const QLOO_BASE_URL = 'https://hackathon.api.qloo.com';

const envText = fs.readFileSync('.env.local', 'utf8');
const geminiKeyMatch = envText.match(/GEMINI_API_KEY(?:S)?\s*=\s*['"]?([^'"\r\n]+)/);
const geminiKey = (geminiKeyMatch ? geminiKeyMatch[1].split(',')[0] : '').trim();

async function runTest() {
  const patient = {
    name: 'Tunde Adeyemi',
    age: 46,
    sex: 'Male',
    location: 'Southwest Houston, TX',
    qlooLocation: 'Houston',
    qlooAge: '36_to_55',
    qlooGender: 'male',
    qlooTagQuery: 'nigerian'
  };

  console.log('================================================================');
  console.log('TEST 1: RAW QLOO TASTE GRAPH ALONE (Zero Generative AI)');
  console.log('================================================================');

  const placesUrl = `${QLOO_BASE_URL}/v2/insights?filter.type=urn:entity:place&filter.location.query=${patient.qlooLocation}&signal.demographics.age=${patient.qlooAge}&signal.demographics.gender=${patient.qlooGender}&take=4`;
  const brandsUrl = `${QLOO_BASE_URL}/v2/insights?filter.type=urn:entity:brand&signal.demographics.age=${patient.qlooAge}&signal.demographics.gender=${patient.qlooGender}&take=4`;
  const tagsUrl = `${QLOO_BASE_URL}/v2/tags?filter.query=${patient.qlooTagQuery}&take=4`;

  const [placesRes, brandsRes, tagsRes] = await Promise.all([
    fetch(placesUrl, { headers: { 'X-Api-Key': QLOO_API_KEY } }).then(r => r.json()),
    fetch(brandsUrl, { headers: { 'X-Api-Key': QLOO_API_KEY } }).then(r => r.json()),
    fetch(tagsUrl, { headers: { 'X-Api-Key': QLOO_API_KEY } }).then(r => r.json())
  ]);

  const rawQloo = {
    endpoint_called: ['/v2/insights (places)', '/v2/insights (brands)', '/v2/tags'],
    places: (placesRes?.results?.entities || []).map(e => ({ name: e.name, affinity: e.query?.affinity ? Math.round(e.query.affinity * 100) + '%' : 'N/A' })),
    brands: (brandsRes?.results?.entities || []).map(e => ({ name: e.name, affinity: e.query?.affinity ? Math.round(e.query.affinity * 100) + '%' : 'N/A' })),
    tags: (tagsRes?.results?.tags || []).map(t => t.name)
  };
  console.log(JSON.stringify(rawQloo, null, 2));

  console.log('\n================================================================');
  console.log('TEST 2: GENERATIVE AI ALONE (Gemini with ZERO Qloo Data)');
  console.log('================================================================');
  const promptOnlyAI = `You are a medical assistant briefing Dr. Aryta about patient Tunde Adeyemi (46-year-old male living in Southwest Houston, TX). Describe their lifestyle, diet, transit, and daily whereabouts based purely on general demographic assumptions. Keep it concise (~120 words).`;
  const resAI = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: promptOnlyAI }] }] })
  }).then(r => r.json());
  const onlyAIText = resAI?.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log(onlyAIText);

  console.log('\n================================================================');
  console.log('TEST 3: THE HYBRID (Roots: Qloo Taste AI Graph + AI Synthesis)');
  console.log('================================================================');
  const promptHybrid = `You are Roots, an advanced Clinical Lifestyle Intelligence System powered by Qloo Taste AI Graph briefing Dr. Aryta about Tunde Adeyemi (46, male, Southwest Houston, TX).
Ground your analysis strictly in Qloo Taste Graph signals for this cohort:
- Regional Venues: ${rawQloo.places.map(p => p.name).join(', ')}
- Consumer Brands: ${rawQloo.brands.map(b => b.name).join(', ')}
- Cultural Demographic Tags: ${rawQloo.tags.join(', ')}

Structure into three concise sections: Neighborhood Environment, Dietary Spectrum & Sourcing, and Daily Rhythm. Keep it clinical and analytical (~130 words).`;
  const resHybrid = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: promptHybrid }] }] })
  }).then(r => r.json());
  const hybridText = resHybrid?.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log(hybridText);
}

runTest();
