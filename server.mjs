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
  const apiKey = getNextGeminiKey();
  const placesList = (qlooData.places || []).map((p) => `${p.name} (affinity ${p.affinity}%)`).join(', ');
  const brandsList = (qlooData.brands || []).map((b) => b.name).join(', ');
  const tagsList = (qlooData.tags || []).map((t) => t.name).join(', ');

  const systemInstruction = `You are Roots, an objective Clinical Lifestyle Intelligence organizer collaborating with attending physician Dr. Aryta.
CRITICAL SAFETY & CLINICAL BOUNDARY:
- You do NOT give medical advice or clinical diagnosis.
- You must NEVER state, diagnose, or hint at what disease or medical condition is wrong with the patient.
- Your sole job is to synthesize:
  1. The local standard of living & environmental infrastructure in that city/neighborhood (water quality, transit jarring, pollution, food refrigeration/hygiene, economic stressors).
  2. Common endemic regional illnesses and epidemiological patterns typical of that geography.
  3. The peer lifestyle, recreational, and dietary attributes retrieved from the Qloo Taste Graph.
- Organize all these factors into clear, objective anamnesis lifestyle factors and questions for Dr. Aryta to explore during patient examination.

PATIENT FILE:
- Name: ${patient.name} (${patient.age}y, ${patient.sex})
- Location: ${patient.location}
- Occupation: ${patient.occupation}
- Marital/Social: ${patient.maritalStatus}
- Chief Complaint: ${patient.chiefComplaint}
- Triage Vitals: ${patient.vitals}
- Baseline Lifestyle: ${(patient.lifestyleSummary || []).join('; ')}

LIVE QLOO DEMOGRAPHIC & CULTURAL TASTE SIGNALS:
- Local Venues / Food Spots / Staples: ${placesList || 'Regional markets, local food vendors, and transit hubs'}
- Peer Consumer Brands: ${brandsList || 'Regional food and beverage staples'}
- Cultural & Recreational Tags: ${tagsList || 'Recreation, commuter transit, street food'}

DOCTOR ARYTA'S MESSAGE:
"${message}"

INSTRUCTIONS:
Generate the response in this exact JSON schema:
{
  "thoughtProcess": "A 2-3 sentence chain-of-thought analysis reflecting on: (a) the local standard of living and environmental infrastructure in ${patient.location}, (b) regional endemic illnesses in this area, and (c) how the Qloo lifestyle and food/transit habits intersect with Dr. Aryta's query.",
  "standardOfLiving": "A concise summary of the standard of living, transit infrastructure, and environmental factors typical of ${patient.location} relevant to this cohort.",
  "regionalIllnesses": [
    "Common regional/endemic illness pattern 1 typical of ${patient.location} (e.g. food/water-borne, respiratory, environmental)",
    "Common regional/endemic illness pattern 2 typical of ${patient.location}"
  ],
  "clinicalAnalysis": "A neutral, objective summary organizing the patient's lifestyle context (routines, transit, local foods) in relation to Dr. Aryta's query without claiming any diagnosis.",
  "lifestyleFactors": [
    "Specific lifestyle/environmental attribute 1 from Qloo/patient context",
    "Specific lifestyle/environmental attribute 2 from Qloo/patient context"
  ],
  "diagnosticQuestions": [
    {
      "trigger": "Short lifestyle probe name (e.g. 'Daily Transit Jarring' or 'Local Food & Water Source')",
      "question": "The exact objective lifestyle question Dr. Aryta can ask the patient about their routine",
      "clinicalWhy": "The objective anamnesis purpose (e.g. 'Clarifies daily mechanical road impact vs. dietary exposure')"
    }
  ]
}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: systemInstruction }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
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
      return JSON.parse(rawText);
    }
    throw new Error('Empty response from Gemini');
  } catch (err) {
    clearTimeout(timeout);
    console.warn('Gemini query failed, using clinical fallback engine:', err.message);
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
        const message = payload.message || 'Analyze clinical lifestyle factors';

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
        const geminiResult = await queryGeminiClinicalReasoning(patient, message, { places, brands, tags });

        const thoughtProcess =
          geminiResult?.thoughtProcess ||
          `Evaluated standard of living and regional environmental factors for ${patient.location}. Cross-referenced Qloo consumer and venue signals (${places.slice(0, 3).map(p=>p.name).join(', ')}) with Dr. Aryta's query. Formulating objective, non-diagnostic anamnesis prompts.`;

        const standardOfLiving =
          geminiResult?.standardOfLiving ||
          `Urban/peri-urban infrastructure in ${patient.location}. Variable road quality causing mechanical commuter vibration, dependence on municipal or localized boreholes/sachet water, and common ambient exposure to outdoor street vendors.`;

        const regionalIllnesses =
          geminiResult?.regionalIllnesses && geminiResult.regionalIllnesses.length > 0
            ? geminiResult.regionalIllnesses
            : ['Enteric food/water pathogens (Salmonella / Amebiasis)', 'Vector-borne tropical infections (Malaria)', 'Gastrointestinal gastritis from irregular dining'];

        const analysis =
          geminiResult?.clinicalAnalysis ||
          `Dr. Aryta, ${patient.name}'s presentation requires cross-referencing acute symptoms against their regional lifestyle in ${patient.location}. The peer demographic signals highlight local mobility and recreational exertion as critical anamnesis targets.`;

        const lifestyleFactors =
          geminiResult?.lifestyleFactors && geminiResult.lifestyleFactors.length > 0
            ? geminiResult.lifestyleFactors
            : patient.lifestyleSummary || [
                `Local peer activity patterns in ${patient.location}`,
                `Regional dietary staples and commuter factors`,
              ];

        const diagnosticQuestions =
          geminiResult?.diagnosticQuestions && geminiResult.diagnosticQuestions.length > 0
            ? geminiResult.diagnosticQuestions
            : patient.diagnosticQuestions || [];

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            success: true,
            provider: geminiResult ? 'gemini-2.5-flash + qloo' : 'qloo-clinical-engine',
            thoughtProcess,
            standardOfLiving,
            regionalIllnesses,
            analysis,
            lifestyleFactors,
            diagnosticQuestions,
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
