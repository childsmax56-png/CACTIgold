// Merges extracted hyperlinks from cactigold_links.json into the public/data CSVs
// Usage: node scripts/merge-links.mjs

import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'path';

// ── Config ────────────────────────────────────────────────────────────────────

const JSON_PATH = `${process.env.HOME}/Downloads/cactigold_links.json`;

const SHEETS = {
  Unreleased:  { csv: 'unreleased.csv',  eraCol: 0, nameCol: 1, linkJsonCol: '9', linkCsvCol: 8  },
  Released:    { csv: 'released.csv',    eraCol: 0, nameCol: 1, linkJsonCol: '8', linkCsvCol: 7  },
  Stems:       { csv: 'stems.csv',       eraCol: 0, nameCol: 1, linkJsonCol: '7', linkCsvCol: 9  },
  Fakes:       { csv: 'fakes.csv',       eraCol: 0, nameCol: 1, linkJsonCol: '5', linkCsvCol: 6  },
  Tracklists:  { csv: 'tracklists.csv',  eraCol: 0, nameCol: 1, linkJsonCol: '7', linkCsvCol: 7  },
};

const CSV_DIR = new URL('../public/data/', import.meta.url).pathname;

// ── CSV parser/serialiser (handles quoted multiline fields) ───────────────────

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false, i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (ch === '"') { inQuotes = false; i++; continue; }
      field += ch;
    } else {
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      if (ch === '\r' && text[i + 1] === '\n') { i++; continue; }
      field += ch;
    }
    i++;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function fieldToCSV(value) {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function serializeCSV(rows) {
  return rows.map(row => row.map(fieldToCSV).join(',')).join('\n') + '\n';
}

// ── Key normalisation ─────────────────────────────────────────────────────────

function norm(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// ── Main ──────────────────────────────────────────────────────────────────────

const jsonData = JSON.parse(readFileSync(JSON_PATH, 'utf8'));

for (const [sheetName, cfg] of Object.entries(SHEETS)) {
  const rows = jsonData[sheetName];
  if (!rows) { console.log(`${sheetName}: not found in JSON, skipping`); continue; }

  // Build lookup: (era, name) → URL string
  const lookup = new Map();
  for (const entry of rows) {
    if (!entry.links[cfg.linkJsonCol]) continue;
    const era  = norm(entry.values[cfg.eraCol]);
    const name = norm(entry.values[cfg.nameCol]);
    const url  = Array.isArray(entry.links[cfg.linkJsonCol])
      ? entry.links[cfg.linkJsonCol].join(' ')
      : entry.links[cfg.linkJsonCol];
    lookup.set(`${era}|||${name}`, url);
  }

  // Read and update CSV
  const csvPath = CSV_DIR + cfg.csv;
  const csvRows = parseCSV(readFileSync(csvPath, 'utf8'));

  let updated = 0;
  for (let i = 1; i < csvRows.length; i++) {  // skip header
    const row = csvRows[i];
    if (!row || row.length <= cfg.linkCsvCol) continue;

    const era  = norm(row[cfg.eraCol]);
    const name = norm(row[cfg.nameCol]);
    const key  = `${era}|||${name}`;

    const url = lookup.get(key);
    if (url) {
      row[cfg.linkCsvCol] = url;
      updated++;
    }
  }

  writeFileSync(csvPath, serializeCSV(csvRows));
  console.log(`${sheetName}: ${updated} / ${lookup.size} links merged → ${cfg.csv}`);
}
