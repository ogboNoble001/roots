import fs from 'node:fs';
import path from 'node:path';

// Load .env.local if present
function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = (match[2] || '').trim();
          val = val.replace(/(^['"]|['"]$)/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (_) {}
}
loadEnv();

export const QLOO_API_KEY = process.env.QLOO_API_KEY || 'hack_79608ef0cbb3f7d7c60a9d6dee03ac2d6cf6deef';
export const QLOO_BASE_URL = process.env.QLOO_API_BASE_URL || 'https://hackathon.api.qloo.com';

const DEFAULT_GEMINI_FALLBACK = Buffer.from('QVEuQWI4Uk42TDdkT2tWZGlvNXRQbEc0Ti1qSEd1VFlYV1BKdUpfVG13V2FRQW5rTjdUTFE=', 'base64').toString('utf8');

export const GEMINI_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_FALLBACK)
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

let activeGeminiKeyIndex = 0;
export function getNextGeminiKey() {
  if (GEMINI_KEYS.length === 0) return '';
  const key = GEMINI_KEYS[activeGeminiKeyIndex % GEMINI_KEYS.length];
  activeGeminiKeyIndex = (activeGeminiKeyIndex + 1) % GEMINI_KEYS.length;
  return key;
}

export async function fetchQlooEndpoint(endpointPath, params = {}) {
  const url = new URL(`${QLOO_BASE_URL}${endpointPath}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Api-Key': QLOO_API_KEY,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await response.json();
    return { ok: response.ok, status: response.status, data, url: url.pathname + url.search };
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, status: 500, error: err.message, url: url.pathname + url.search };
  }
}

// Extract dynamic search topics from user queries
export function extractDynamicQueryTopic(message, defaultTag = 'food') {
  const m = (message || '').toLowerCase();
  if (/maternal|pregnant|pregnancy|antenatal|birth|baby|infant|health\s*care|clinic|hospital|doctor|delivery|maternity/i.test(m)) {
    return 'hospital';
  }
  if (/hygiene|clean|sanitation|safety|wash|spoil|storage|bacteria|microb/i.test(m)) {
    return 'hygiene';
  }
  if (/water|drink|beverage|hydration|sachet|borehole|tap|bottle|fluid/i.test(m)) {
    return 'beverage';
  }
  if (/carb|sugar|fat|protein|nutrition|macronutrient|calorie|diet/i.test(m)) {
    return 'nutrition';
  }
  if (/seasoning|spice|salt|sodium|maggi|knorr|pepper|oil/i.test(m)) {
    return 'seasoning';
  }
  if (/medicine|drug|pharmacy|chemist|pill|painkiller|nsaid|diclofenac|paracetamol|supplement|herbal|bitters/i.test(m)) {
    return 'pharmacy';
  }
  if (/market|grocery|supermarket|shop|store|buka|stall|vendor|buy|procure/i.test(m)) {
    return 'market';
  }
  if (/commute|transit|road|traffic|drive|car|keke|bus|vibration|distance/i.test(m)) {
    return 'transportation';
  }
  if (/exercise|sport|fitness|workout|walk|active|gym|football/i.test(m)) {
    return 'fitness';
  }
  return defaultTag;
}

export async function queryGeminiOnce(apiKey, patient, message, qlooData) {
  const qlooVenues = (qlooData.places || []).map((p) => {
    const dishesStr = (p.dishes && p.dishes.length > 0) ? ` [Qloo Discovered Dishes & Items: ${p.dishes.join(', ')}]` : '';
    const addrStr = p.address ? ` [Address: ${p.address}]` : '';
    return `• ${p.name} (${p.primaryGenre || 'Venue'})${addrStr}${dishesStr}`;
  }).join('\n');

  const allQlooDishes = Array.from(new Set(
    (qlooData.places || []).flatMap((p) => p.dishes || [])
  ));

  const brandsList = (qlooData.brands || []).map((b) => b.name).join(', ');
  const tagsList = (qlooData.tags || []).map((t) => t.name).join(', ');

  const cohort = `${patient.sex === 'Female' ? 'women' : patient.sex === 'Male' ? 'men' : 'individuals'} aged approximately ${patient.age}`;
  const isBriefing = !message || message.startsWith('Provide a rich');

  const systemInstruction = `You are Roots, an advanced Clinical Lifestyle Intelligence System powered by the Qloo Taste AI Graph, briefing attending physician Dr. Aryta.

PROFESSIONAL TONE & CLINICAL REGISTER:
- Maintain an objective, informative, and clinical demographic register.
- Avoid casual banter, colloquial slang, or storytelling.
- Use precise, analytical terminology (e.g., "transit corridor", "dietary composition", "mechanical vibration", "culinary staples", "sodium density", "post-prandial load").
- No emojis. No conversational openings or sign-offs. Start directly with the structured analysis.

CRITICAL ARCHITECTURAL ROLE:
You are an intelligent clinical intermediary between the Qloo Taste Graph and the physician Dr. Aryta.
Your job is to take the verified Qloo Taste Graph data below (dishes, food categories, venues, addresses, brands, tags) and organize it into clinically actionable lifestyle intelligence.
- 100% GROUNDED IN QLOO: When answering dietary or food questions, you MUST directly cite and analyze the verified Qloo dishes and culinary highlights provided below (such as ${allQlooDishes.slice(0, 6).join(', ') || 'verified regional items'}).
- Do NOT generate generic textbook filler. Organize Qloo's data into clear, actionable clinical insight.

CRITICAL ANALYTICAL BOUNDARIES:
1. NO RIGID STEREOTYPES OR TIMETABLES: Do not pretend every individual in a neighborhood follows a single rigid daily schedule. Frame findings as common local patterns, dietary spectrums, and typical environmental realities across this demographic cohort (${cohort}) in ${patient.location}.
2. DIVERSE SOCIOECONOMIC SPECTRUM: Reflect realistic local realities. For example, do not assume everyone shops at high-end supermarkets (like SPAR); acknowledge that many residents source fresh food and produce from local neighborhood open-air markets, roadside stalls, and corner patent medicine stores (chemists).
3. NO RELIGIOUS OR SOCIAL ASSUMPTIONS: Do not speculate about personal religious attendance, church fellowship, or spiritual activities. Stick strictly to physical, environmental, dietary, and consumer facts.
4. ZERO MEDICAL LECTURING OR DIAGNOSIS: Never guess or diagnose pathologies, diseases, or physiological damage (do NOT use terms like "gastric erosion", "mucosal damage", "systemic vascular resistance", or "metabolic dysregulation"). Dr. Aryta is the physician and already understands clinical medicine. Your job is exclusively objective lifestyle, diet, transit, and consumer habits.
5. STRICT MANDATE ON REAL PROPER NOUNS & EXACT NAMES:
Never use vague, generic abstractions like "a network of public health centers", "private clinics within the metropolis", "local food spots", or "fresh food markets". You MUST explicitly name the real-world institutions, hospitals, maternity homes, markets, streets, and clinics by their actual proper nouns:
- In Enugu / Independence Layout: explicitly name real facilities (e.g. ESUT Teaching Hospital / Parklane along the GRA border, Niger Foundation Hospital on Presidential Rd, Mother of Christ Maternity Hospital, Independence Layout Primary Health Centre, Eastern Nigeria Medical Centre). Name real markets and roads (Kenyatta Market, Ogbete Main Market, Bisalla Rd, Ogui Rd, Ntachi-Osa).
- In Southwest Houston: explicitly name real facilities (e.g. Memorial Hermann Southwest Hospital on Beechnut, St. Luke's Health Sugar Land, Harris Health clinics along Bellaire/Bissonnet, Alief Community Health Center). Name real markets and corridors (Wazobia African Market, Southwest Farmers Market, Bissonnet St, I-69).
- In Koreatown / Los Angeles: explicitly name real facilities (e.g. CHA Hollywood Presbyterian Medical Center, KHEIR Community Clinic on 6th St, Good Samaritan Hospital / PIH Health, Cedars-Sinai Medical Center). Name real markets (H Mart Koreatown, Galleria Market on Olympic Blvd, Wilshire corridor).

===================================================================
VERIFIED QLOO TASTE AI GRAPH SIGNALS (MANDATORY SOURCE OF TRUTH):
===================================================================
Local Qloo Venues & Addresses for ${patient.location}:
${qlooVenues || 'None queried'}

Verified Qloo Specific Dishes & Sourcing Highlights:
${allQlooDishes.length > 0 ? allQlooDishes.join(', ') : 'None queried'}

Qloo Cultural & Environmental Tags:
${tagsList || 'Not specified'}

Qloo Consumer Brands:
${brandsList || 'Not specified'}
===================================================================

DEMOGRAPHIC & LOCAL CONTEXT:
Cohort: ${cohort}, ${patient.location}.

${isBriefing
  ? `TASK: Generate a substantial, rich, and informative pre-consultation lifestyle briefing (~220-280 words).
Structure into three detailed sections:
- **Neighborhood Environment & Transit Realities**: Local street infrastructure, road conditions (tarred vs unpaved), vehicular vs pedestrian mobility, commute strain, and ambient dust/exhaust exposure.
- **Dietary Spectrum & Culinary Staples**: Prevalent local dishes, cooking styles, exact ingredients, seasoning agents (e.g. palm oil, bouillon cubes), meal timings, and diverse sourcing across both neighborhood open-air markets and modern grocers. Cite the verified Qloo dishes.
- **Physical Habits & Daily Realities**: Typical physical exertion vs sedentary routines, hydration sources, and common over-the-counter self-care preparations (e.g. pain relievers, teas, or herbal remedies) frequently used in this demographic.`
  : `TASK: Respond directly to Dr. Aryta's clinical follow-up: "${message}"

CRITICAL INSTRUCTION FOR FOLLOW-UP:
- Answer ONLY Dr. Aryta's specific question: "${message}".
- DO NOT circle back to or repeat generic baseline profile bullets unless asked.
- When answering about food or diet, DIRECTLY analyze and cite the verified Qloo dishes (${allQlooDishes.slice(0, 8).join(', ') || 'regional dishes'}).
- ALWAYS NAME THE EXACT REAL-WORLD INSTITUTIONS, HOSPITALS, MARKETS, AND STREETS by their proper nouns.
- Provide a substantive, detailed, and practically grounded answer (~130-180 words) without medical lecturing or diagnosing.`}

Output only the markdown text.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: systemInstruction }] }],
          generationConfig: {
            temperature: 0.4,
          },
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Gemini API error (${res.status}): ${errBody.slice(0, 150)}`);
    }

    const json = await res.json();
    const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawText) {
      return rawText;
    }
    throw new Error('Empty response from Gemini');
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export async function queryGeminiClinicalReasoning(patient, message, qlooData) {
  let lastError = null;
  const attempts = Math.max(1, Math.min(GEMINI_KEYS.length, 5));
  for (let i = 0; i < attempts; i++) {
    try {
      const out = await queryGeminiOnce(getNextGeminiKey(), patient, message, qlooData);
      if (out) return { text: out, error: null };
    } catch (err) {
      lastError = err.message;
    }
  }
  return { text: null, error: lastError || 'All Gemini API attempts failed' };
}
