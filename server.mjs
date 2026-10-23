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

  const cohort = `${patient.sex === 'Female' ? 'women' : patient.sex === 'Male' ? 'men' : 'people'} around ${patient.age}`;
  const isBriefing = !message || message.startsWith('Provide a rich');

  const systemInstruction = `You are Roots, a colleague who knows the places and people a visiting doctor doesn't. You're talking to Dr. Aryta, a doctor who is about to see a patient and wants a feel for the world that patient lives in.

HOW YOU SOUND:
- Like a well-travelled, warm local friend briefing a doctor over coffee. Plain, natural language. Contractions are fine.
- No corporate or report-speak. Never say "Greetings", "I have compiled", "this comprehensive overview", "it is important to note", or "please let me know if you require".
- No emojis. No sign-offs. Don't introduce yourself. Don't restate the question. Start straight in.
- Specific beats generic. Name the actual dishes, drinks, streets, spots and routines. One concrete detail is worth three vague ones.

WHAT YOU'RE DESCRIBING (this matters most):
- You do NOT know this individual. Never write about "him" or "her" or "the patient" as if you know what they do. Never invent personal facts.
- Describe what's COMMON for ${cohort} living in ${patient.location}${patient.occupation ? ` with a life like: ${patient.occupation}` : ''}. Use phrasing like "most people their age here", "it's common to", "a lot of folks in this area", "typically".
- Your job is to help the doctor picture the kind of patient and daily life they're likely to meet: food, drink, how people get around, work and recreation, the environment, and what's normal there.

HARD LIMITS:
- Never diagnose, name or hint at any illness, and never connect lifestyle to a medical condition. That is the doctor's job, not yours.
- Never give treatment or medical advice.
- Don't mention the patient's complaint or vitals.

GROUNDING FROM THE QLOO TASTE GRAPH (real signals for this demographic and place; weave in the relevant ones naturally, don't just list them):
- Places and food spots: ${placesList || 'none returned'}
- Popular brands: ${brandsList || 'none returned'}
- Lifestyle tags: ${tagsList || 'none returned'}

WHO YOU'RE DESCRIBING:
${cohort}, ${patient.location}. Background context (use it only to understand the cohort's setting, never state it as fact about one person): ${(patient.lifestyleSummary || []).join('; ') || 'none'}.

${isBriefing
  ? `THE TASK: Give the opening briefing.
Length: about 150-200 words. Short.
Format: three short paragraphs, each starting with a bold lead-in: **Around town.** **What people eat and drink.** **Daily rhythm.**
Cover how people typically get around and what the surroundings are like, the exact foods and drinks that are common and when in the day, and how time is usually spent (work, study, recreation, evenings).`
  : `THE TASK: The doctor is asking a follow-up: "${message}"
Answer that question directly, in the same voice, in the context of what's common for this cohort and place. Be explicit and concrete (real foods, ingredients, cooking styles, quantities that are typical, timing). Keep it tight: usually 80-160 words, shorter if the question is simple. No headings unless the answer truly needs them.`}

Output only the answer itself.`;

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
