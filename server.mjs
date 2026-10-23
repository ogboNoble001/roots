import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local if present
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
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
}
loadEnv();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const QLOO_API_KEY = process.env.QLOO_API_KEY || 'hack_79608ef0cbb3f7d7c60a9d6dee03ac2d6cf6deef';
const QLOO_BASE_URL = process.env.QLOO_API_BASE_URL || 'https://hackathon.api.qloo.com';

const GEMINI_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

let activeGeminiKeyIndex = 0;
function getNextGeminiKey() {
  if (GEMINI_KEYS.length === 0) return '';
  const key = GEMINI_KEYS[activeGeminiKeyIndex % GEMINI_KEYS.length];
  activeGeminiKeyIndex = (activeGeminiKeyIndex + 1) % GEMINI_KEYS.length;
  return key;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

async function fetchQlooEndpoint(endpointPath, params = {}) {
  const url = new URL(`${QLOO_BASE_URL}${endpointPath}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

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

async function queryGeminiClinicalReasoning(patient, message, qlooData) {
  const attempts = Math.max(1, Math.min(GEMINI_KEYS.length, 5));
  for (let i = 0; i < attempts; i++) {
    const out = await queryGeminiOnce(getNextGeminiKey(), patient, message, qlooData);
    if (out) return out;
  }
  return null;
}

// Extract dynamic search topics from user queries
function extractDynamicQueryTopic(message, defaultTag = 'food') {
  const m = (message || '').toLowerCase();
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

async function queryGeminiOnce(apiKey, patient, message, qlooData) {
  const placesList = (qlooData.places || []).map((p) => `${p.name} (affinity ${p.affinity}%)`).join(', ');
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

CRITICAL ANALYTICAL BOUNDARIES:
1. NO RIGID STEREOTYPES OR TIMETABLES: Do not pretend every individual in a neighborhood follows a single rigid daily schedule. Frame findings as common local patterns, dietary spectrums, and typical environmental realities across this demographic cohort (${cohort}) in ${patient.location}.
2. DIVERSE SOCIOECONOMIC SPECTRUM: Reflect realistic local realities. For example, do not assume everyone shops at high-end supermarkets (like SPAR); acknowledge that many residents source fresh food and produce from local neighborhood open-air markets, roadside stalls, and corner patent medicine stores (chemists).
3. NO RELIGIOUS OR SOCIAL ASSUMPTIONS: Do not speculate about personal religious attendance, church fellowship, or spiritual activities. Stick strictly to physical, environmental, dietary, and consumer facts.
4. ZERO MEDICAL LECTURING OR DIAGNOSIS: Never guess or diagnose pathologies, diseases, or physiological damage (do NOT use terms like "gastric erosion", "mucosal damage", "systemic vascular resistance", or "metabolic dysregulation"). Dr. Aryta is the physician and already understands clinical medicine. Your job is exclusively objective lifestyle, diet, transit, and consumer habits.

GROUNDING SIGNALS FROM QLOO TASTE GRAPH FOR THIS TOPIC:
- Regional Venues & Hubs: ${placesList || 'Not specified'}
- Consumer Brands: ${brandsList || 'Not specified'}
- Cultural & Environmental Tags: ${tagsList || 'Not specified'}

DEMOGRAPHIC & LOCAL CONTEXT:
Cohort: ${cohort}, ${patient.location}.

${isBriefing
  ? `TASK: Generate a substantial, rich, and informative pre-consultation lifestyle briefing (~220-280 words).
Structure into three detailed sections:
- **Neighborhood Environment & Transit Realities**: Local street infrastructure, road conditions (tarred vs unpaved), vehicular vs pedestrian mobility, commute strain, and ambient dust/exhaust exposure.
- **Dietary Spectrum & Culinary Staples**: Prevalent local dishes, cooking styles, exact ingredients, seasoning agents (e.g. palm oil, bouillon cubes), meal timings, and diverse sourcing across both neighborhood open-air markets and modern grocers.
- **Physical Habits & Daily Realities**: Typical physical exertion vs sedentary routines, hydration sources, and common over-the-counter self-care preparations (e.g. pain relievers, teas, or herbal remedies) frequently used in this demographic.`
  : `TASK: Respond directly to Dr. Aryta's clinical follow-up: "${message}"

CRITICAL INSTRUCTION FOR FOLLOW-UP:
- Answer ONLY Dr. Aryta's specific question: "${message}".
- DO NOT circle back to or repeat generic baseline profile bullets (such as Maggi cubes, swallow meals, or herbal bitters) unless the question specifically asked about them!
- For example, if Dr. Aryta asks about "hygiene practices", describe the ACTUAL hygiene and sanitation realities in ${patient.location} for this demographic cohort:
  * Water supply and safety (treated municipal tap vs. filtration pitchers vs. borehole vs. sachet water).
  * Food preparation and storage hygiene (refrigeration consistency during power outages or heat, raw meat temperature control at butcher/suya stands, cross-contamination, produce hot-water/salt washing).
  * Environmental and market sanitation (open stalls, road dust exposure on displayed food, pest control).
- Ground your answer strictly in ${patient.location} for this demographic (${cohort}).
- Provide a substantive, detailed answer (~130-180 words) without medical lecturing or diagnosing.`}

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
      throw new Error(`Gemini API returned status ${res.status}`);
    }

    const json = await res.json();
    const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawText) {
      return rawText;
    }
    throw new Error('Empty response from Gemini');
  } catch (err) {
    clearTimeout(timeout);
    console.warn('Gemini query failed:', err.message);
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Live Qloo API proxy endpoint for demographic & lifestyle insights
  if (reqUrl.pathname === '/api/qloo/lifestyle' && req.method === 'GET') {
    const location = reqUrl.searchParams.get('location') || 'Enugu';
    const ageGroup = reqUrl.searchParams.get('age') || '24_and_younger';
    const gender = reqUrl.searchParams.get('gender') || 'male';
    const tagQuery = reqUrl.searchParams.get('tagQuery') || 'sport';

    const [placesRes, brandsRes, tagsRes] = await Promise.all([
      fetchQlooEndpoint('/v2/insights', {
        'filter.type': 'urn:entity:place',
        'filter.location.query': location,
        'signal.demographics.age': ageGroup,
        'signal.demographics.gender': gender,
        'take': 6,
      }),
      fetchQlooEndpoint('/v2/insights', {
        'filter.type': 'urn:entity:brand',
        'signal.demographics.age': ageGroup,
        'signal.demographics.gender': gender,
        'take': 6,
      }),
      fetchQlooEndpoint('/v2/tags', {
        'filter.query': tagQuery,
        'feature.typo_tolerance': 'true',
        'take': 6,
      }),
    ]);

    const places = (placesRes?.data?.results?.entities || []).map((e) => ({
      name: e.name,
      id: e.entity_id,
      subtype: e.subtype || 'urn:entity:place',
      affinity: e.query?.affinity ? Math.round(e.query.affinity * 100) : null,
    }));

    const brands = (brandsRes?.data?.results?.entities || []).map((e) => ({
      name: e.name,
      id: e.entity_id,
      affinity: e.query?.affinity ? Math.round(e.query.affinity * 100) : null,
    }));

    const tags = (tagsRes?.data?.results?.tags || []).map((t) => ({
      name: t.name,
      id: t.tag_id || t.id,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        success: true,
        qlooServer: QLOO_BASE_URL,
        places,
        brands,
        tags,
      })
    );
    return;
  }

  // Full Agentic Chat Endpoint (Qloo Graph Grounding + Gemini 2.5 Flash Reasoning)
  if (reqUrl.pathname === '/api/roots/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const patient = payload.patient || {};
        const isInitial = !payload.message || payload.message === 'initial_briefing';
        const message = isInitial
          ? `Provide a rich, explicit, and summarized lifestyle briefing for ${patient.name}. Detail who people in this cohort are, what their neighborhood and whereabouts are like, and the exact foods, dietary habits, and lifestyle realities they experience daily based on the Qloo graph.`
          : payload.message;

        const location = patient.qlooLocation || 'Enugu';
        const ageGroup = patient.qlooAge || '24_and_younger';
        const gender = patient.qlooGender || 'male';

        // Dynamically resolve tag topic from the query if this is a follow-up
        const dynamicTopic = isInitial ? (patient.qlooTagQuery || 'food') : extractDynamicQueryTopic(message, patient.qlooTagQuery || 'food');

        // Only return places chips if explicitly asked to list specific venues/locations, or for the initial briefing
        const asksForPlaces = isInitial || /\b(where\s+do\s+they|which\s+(supermarkets?|grocer(y|ies)|markets?|restaurants?|cafes?|eater(y|ies)|spots?|stores?|shops?|venues?)|list\s+places|specific\s+spots|what\s+markets)\b/i.test(message);

        // 1. Fetch live Qloo entities dynamically tailored to this patient & topic
        const [placesRes, brandsRes, tagsRes] = await Promise.all([
          asksForPlaces
            ? fetchQlooEndpoint('/v2/insights', {
                'filter.type': 'urn:entity:place',
                'filter.location.query': location,
                'signal.demographics.age': ageGroup,
                'signal.demographics.gender': gender,
                'take': 6,
              })
            : Promise.resolve({ data: { results: { entities: [] } } }),
          asksForPlaces || isInitial
            ? fetchQlooEndpoint('/v2/insights', {
                'filter.type': 'urn:entity:brand',
                'signal.demographics.age': ageGroup,
                'signal.demographics.gender': gender,
                'take': 6,
              })
            : Promise.resolve({ data: { results: { entities: [] } } }),
          fetchQlooEndpoint('/v2/tags', {
            'filter.query': dynamicTopic,
            'feature.typo_tolerance': 'true',
            'take': 6,
          }),
        ]);

        const places = (placesRes?.data?.results?.entities || []).map((e) => ({
          name: e.name,
          id: e.entity_id,
          affinity: e.query?.affinity ? Math.round(e.query.affinity * 100) : null,
        }));

        const brands = (brandsRes?.data?.results?.entities || []).map((e) => ({
          name: e.name,
          id: e.entity_id,
          affinity: e.query?.affinity ? Math.round(e.query.affinity * 100) : null,
        }));

        const tags = (tagsRes?.data?.results?.tags || []).map((t) => ({
          name: t.name,
          id: t.tag_id || t.id,
        }));

        // 2. Query Gemini 2.5 Flash with Qloo Grounding
        const rawOutput = await queryGeminiClinicalReasoning(patient, message, { places, brands, tags });

        let text = rawOutput || '';
        let thoughtProcess = null;

        // Parse optional <thought>...</thought>
        const thoughtMatch = text.match(/<thought>([\s\S]*?)<\/thought>/i);
        if (thoughtMatch) {
          thoughtProcess = thoughtMatch[1].trim();
          text = text.replace(/<thought>[\s\S]*?<\/thought>/i, '').trim();
        }

        if (!text) {
          res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'The AI did not respond. Please try again.' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            provider: rawOutput ? 'gemini-2.5-flash + qloo' : 'qloo-lifestyle-engine',
            text,
            thoughtProcess,
            places,
            brands,
            tags,
          })
        );
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Static File Server
  let pathname = reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname;
  const filePath = path.join(PUBLIC_DIR, pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Roots UI & Qloo Server running at http://localhost:${PORT}`);
});
