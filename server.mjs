import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const QLOO_API_KEY = process.env.QLOO_API_KEY || 'hack_79608ef0cbb3f7d7c60a9d6dee03ac2d6cf6deef';
const QLOO_BASE_URL = process.env.QLOO_API_BASE_URL || 'https://hackathon.api.qloo.com';

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
        'Accept': 'application/json',
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

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);

  // Live Qloo API proxy endpoint for Roots Lifestyle Intelligence
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
        queries: [placesRes.url, brandsRes.url, tagsRes.url],
        places,
        brands,
        tags,
      })
    );
    return;
  }

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
