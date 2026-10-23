// Pre-generates the opening Qloo lifestyle briefing for every patient in public/index.html
// and saves them to public/briefings.json so patients open instantly.
// Usage: start the server (node server.mjs), then run: node scripts/prebake.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
const outPath = path.join(__dirname, '..', 'public', 'briefings.json');
const API = process.env.ROOTS_API || 'http://localhost:3000/api/roots/chat';

const html = fs.readFileSync(htmlPath, 'utf8');
const match = html.match(/const PATIENTS = (\[[\s\S]*?\n    \]);/);
if (!match) throw new Error('Could not find PATIENTS array in index.html');
const patients = new Function(`return ${match[1]}`)();

const result = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};

for (const patient of patients) {
  let done = false;
  for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient, message: 'initial_briefing' }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || 'failed');
      result[patient.id] = {
        text: d.text,
        thoughtProcess: d.thoughtProcess || null,
        places: (d.places || []).slice(0, 5).map((p) => p.name),
        brands: (d.brands || []).slice(0, 5).map((b) => b.name),
        tags: (d.tags || []).slice(0, 5).map((t) => t.name),
      };
      console.log(`✓ ${patient.name} (${patient.id})`);
      done = true;
    } catch (e) {
      console.log(`  retry ${attempt} for ${patient.name}: ${e.message}`);
    }
  }
  if (!done) console.log(`✗ ${patient.name} failed`);
}

fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
console.log(`Saved ${Object.keys(result).length} briefings to public/briefings.json`);
