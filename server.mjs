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

async function queryGeminiOnce(apiKey, patient, message, qlooData) {
  const placesList = (qlooData.places || []).map((p) => `${p.name} (affinity ${p.affinity}%)`).join(', ');
  const brandsList = (qlooData.brands || []).map((b) => b.name).join(', ');
  const tagsList = (qlooData.tags || []).map((t) => t.name).join(', ');

  const cohort = `${patient.sex === 'Female' ? 'women' : patient.sex === 'Male' ? 'men' : 'individuals'} aged approximately ${patient.age}`;
  const isBriefing = !message || message.startsWith('Provide a rich');

  const systemInstruction = `You are Roots, an advanced Clinical Lifestyle Intelligence System powered by the Qloo Taste AI Graph, briefing attending physician Dr. Aryta.

PROFESSIONAL TONE & CLINICAL REGISTER:
- Maintain a professional, objective, clinical, and sociological register.
- Avoid casual colloquialisms, slang, or conversational banter (never use phrases like "Alright, for guys...", "classic outing", "pretty cool", or "kids and unwinding").
- Use precise, analytical terminology (e.g., "transit corridor", "dietary composition", "mechanical vibration", "culinary staples", "sodium density", "post-prandial habits").
- No emojis. No conversational openings or sign-offs. Start directly with the structured analysis.

ANALYTICAL BOUNDARIES:
- Cohort-Level Assessment: You do NOT personally know this individual. Frame all observations objectively around what is prevalent and characteristic of this demographic cohort (${cohort}) in ${patient.location}.
- Zero Diagnostic Claims: Never state or guess medical diagnoses or pathologies. That belongs solely to Dr. Aryta's clinical examination.
- High Specificity: Detail the exact regional dishes, cooking methods, local ingredients, transit realities, and peer habits grounded in the Qloo Taste Graph.

GROUNDING SIGNALS FROM QLOO TASTE GRAPH:
- Regional Venues & Hubs: ${placesList || 'Not specified'}
- Consumer Brands: ${brandsList || 'Not specified'}
- Cultural Tags: ${tagsList || 'Not specified'}

DEMOGRAPHIC & LOCAL CONTEXT:
Cohort: ${cohort}, ${patient.location}. Environmental context: ${(patient.lifestyleSummary || []).join('; ') || 'Urban residential corridor'}.

${isBriefing
  ? `TASK: Generate a concise, high-signal pre-consultation lifestyle briefing (~160-200 words).
Structure into three concise, bolded sections:
- **Urban Transit & Environmental Context**: Physical mobility, transit corridors, vibration/ergonomics, road infrastructure, and ambient conditions in ${patient.location}.
- **Dietary Staples & Culinary Composition**: Prevalent regional dishes, specific food preparation styles, ingredients, meal timings, and beverage patterns typical of this demographic.
- **Daily Rhythm & Behavioral Norms**: Schedule structure, work/shift patterns, physical recreation, and common self-care or domestic habits.`
  : `TASK: Respond directly to Dr. Aryta's clinical follow-up: "${message}"
Address the specific question directly using objective demographic and dietary facts (e.g. macronutrient composition, specific ingredients, portion profiles, or physical stress). Keep it analytical, precise, and concise (~90-150 words).`}

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
        const tagQuery = patient.qlooTagQuery || 'sport';

        // 1. Fetch live Qloo entities for this patient
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
