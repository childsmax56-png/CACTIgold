#!/usr/bin/env node
// Fetches Travis Scott Tracker 2.0 from Google Sheets and transforms CSVs
// into the format expected by the gold tracker codebase.

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHEET_ID = '1gJqbQrb3dIWF-PLMsKkNUrftpQb8zxsZFDAIpSvT5Fo';
const OUT_DIR = join(__dirname, '../public/data');

// ── CSV parser ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const rows = [];
  let current = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];
    if (inQ) {
      if (ch === '"' && nx === '"') { field += '"'; i++; }
      else if (ch === '"') inQ = false;
      else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { current.push(field); field = ''; }
      else if (ch === '\n') { current.push(field); rows.push(current); current = []; field = ''; }
      else if (ch !== '\r') field += ch;
    }
  }
  if (field || current.length > 0) { current.push(field); rows.push(current); }
  return rows;
}

// ── CSV serializer ───────────────────────────────────────────────────────────
function toCSV(rows) {
  return rows.map(row =>
    row.map(cell => {
      const s = (cell ?? '').toString();
      return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    }).join(',')
  ).join('\n');
}

// ── Fetch a sheet ────────────────────────────────────────────────────────────
async function fetchSheet(name) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.status}`);
  return await res.text();
}

// ── Transform: Unreleased ────────────────────────────────────────────────────
// Source cols: [0]=Era [1]=Title [2]=tag? [3]=Notes [4]=Length [5]=FileDate [6]=LeakDate [7]=Available [8]=Sources [9]=Links
// Target:      Era, Name, Notes, Track Length, File Date, Leak Date, Available Length, Quality, Link(s)
function transformUnreleased(raw) {
  const rows = parseCSV(raw);
  const out = [['Era', 'Name', 'Notes', 'Track Length', 'File Date', 'Leak Date', 'Available Length', 'Quality', 'Link(s)']];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const era   = r[0] ?? '';
    const title = r[1] ?? '';
    const tag   = r[2] ?? '';
    const notes = r[3] ?? '';
    const len   = r[4] ?? '';
    const fdate = r[5] ?? '';
    const ldate = r[6] ?? '';
    const avail = r[7] ?? '';
    // r[8] = Sources (dropped)
    const links = r[9] ?? '';

    // Skip rows that are only metadata / header lines (first col contains '|')
    if (era.includes('| Last Updated') || era.includes('| Hover')) continue;

    out.push([era, title, notes, len, fdate, ldate, avail, tag, links]);
  }
  return toCSV(out);
}

// ── Transform: Released ──────────────────────────────────────────────────────
// Source cols: [0]=Era [1]=Title [2]=? [3]=Notes [4]=Length [5]=ReleaseDate [6]=Streaming [7]=Sources [8]=Links
// Target:      Era, Name, Notes, Length, Release Date, Type, Streaming, Link(s)
// Type is inferred from sub-category header rows (era empty, title = "Features"/"Production"/etc.)
function transformReleased(raw) {
  const rows = parseCSV(raw);
  const TYPE_MAP = {
    'features': 'Feature',
    'feature': 'Feature',
    'production': 'Production',
    'productions': 'Production',
    'singles': 'Single',
    'single': 'Single',
    'projects': 'Album Track',
    'project': 'Album Track',
    'album tracks': 'Album Track',
    'other': 'Other',
  };
  const out = [['Era', 'Name', 'Notes', 'Length', 'Release Date', 'Type', 'Streaming', 'Link(s)']];
  let currentType = 'Album Track';
  let currentEraOverride = null;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const era     = r[0] ?? '';
    const title   = r[1] ?? '';
    const notes   = r[3] ?? '';
    const len     = r[4] ?? '';
    const reldate = r[5] ?? '';
    const stream  = r[6] ?? '';
    // r[7] = Sources (dropped)
    const links   = r[8] ?? '';

    if (era.includes('| Last Updated') || era.includes('| Hover')) continue;

    // Era section header rows with newline (e.g. "Days Before Rodeo\n(2013-2014)")
    if (!era.trim() && title.includes('\n')) {
      currentEraOverride = null;
      currentType = 'Album Track';
      continue;
    }

    // Rows where era is empty and title has no newline
    if (!era.trim() && title.trim()) {
      const mapped = TYPE_MAP[title.trim().toLowerCase()];
      if (mapped) { currentType = mapped; continue; }
      // Not a type header — it's an era sub-section header (e.g. "Days Before Rodeo (Re-Release)")
      currentEraOverride = title.trim();
      currentType = 'Album Track';
      continue;
    }

    const effectiveEra = currentEraOverride || era;
    out.push([effectiveEra, title, notes, len, reldate, currentType, stream, links]);
  }
  return toCSV(out);
}

// ── Transform: Stems ────────────────────────────────────────────────────────
// Source cols: [0]=Era [1]=Title [2]=? [3]=Notes [4]=DropDate [5]=Available [6]=Sources [7]=Links
// Target:      Era, Name, Notes, File Date, Leak Date, Full Length, BPM, Available Length, Quality, Link(s)
function transformStems(raw) {
  const rows = parseCSV(raw);
  const out = [['Era', 'Name', 'Notes', 'File Date', 'Leak Date', 'Full Length', 'BPM', 'Available Length', 'Quality', 'Link(s)']];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const era   = r[0] ?? '';
    const title = r[1] ?? '';
    const tag   = r[2] ?? '';
    const notes = r[3] ?? '';
    const drop  = r[4] ?? '';  // "Drop Date" used as Leak Date
    const avail = r[5] ?? '';
    // r[6] = Sources (dropped)
    const links = r[7] ?? '';

    if (era.includes('| Last Updated')) continue;
    if (!era.trim() && title.includes('\n')) continue;

    out.push([era, title, notes, '', drop, '', '', avail, tag, links]);
  }
  return toCSV(out);
}

// ── Transform: Fakes ────────────────────────────────────────────────────────
// Source cols: [0]=(spacer/Era) [1]=Title [2]=? [3]=Notes [4]=Type [5]=Sources
// Target:      Era, Name, "Notes (yellow border...)", Made By, Type, Available Length, Link(s)
function transformFakes(raw) {
  const rows = parseCSV(raw);
  const out = [['Era', 'Name', 'Notes\n(yellow border indicates a detag, audio fix, or a good fake)', 'Made By', 'Type', 'Available Length', 'Link(s)']];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const era   = (r[0] ?? '').trim();
    const title = r[1] ?? '';
    const notes = r[3] ?? '';
    const type  = r[4] ?? '';

    if (era.includes('| Last Updated')) continue;
    // Skip "| Last Updated" in era col (era col is spaces + | ...)
    if ((r[0] ?? '').includes('| Last Updated')) continue;
    // Skip category header rows (era empty, title is a label without song chars)
    if (!era && title.trim() && title.includes('\n')) continue;

    out.push([era, title, notes, '', type, 'Not Available', '']);
  }
  return toCSV(out);
}

// ── Transform: Tracklists ───────────────────────────────────────────────────
// Source cols: [0]=Era [1]=Title [2]=Notes [3]=? [4]=Image [5]=? [6]=Quality [7]=Links
// Target:      Era, Name, Tracklist, Image, Date Made, Quality, Source, Link(s)
function transformTracklists(raw) {
  const rows = parseCSV(raw);
  const out = [['Era', 'Name', 'Tracklist', 'Image', 'Date Made', 'Quality', 'Source', 'Link(s)']];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const era   = r[0] ?? '';
    const title = r[1] ?? '';
    const notes = r[2] ?? '';
    const image = r[4] ?? '';
    const qual  = r[6] ?? '';
    const links = r[7] ?? '';

    if (era.includes('| Last Updated') || era.includes('| Hover')) continue;
    if (!era.trim() && !title.trim()) continue;

    out.push([era, title, notes, image, '', qual, '', links]);
  }
  return toCSV(out);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const transforms = [
    { sheet: 'Unreleased',  file: 'unreleased.csv',  fn: transformUnreleased },
    { sheet: 'Released',    file: 'released.csv',    fn: transformReleased },
    { sheet: 'Stems',       file: 'stems.csv',       fn: transformStems },
    { sheet: 'Fakes',       file: 'fakes.csv',       fn: transformFakes },
    { sheet: 'Tracklists',  file: 'tracklists.csv',  fn: transformTracklists },
  ];

  for (const { sheet, file, fn } of transforms) {
    process.stdout.write(`Fetching ${sheet}...`);
    const raw = await fetchSheet(sheet);
    const csv = fn(raw);
    const outPath = join(OUT_DIR, file);
    writeFileSync(outPath, csv, 'utf8');
    const lines = csv.split('\n').length;
    console.log(` ✓  ${lines} rows → ${file}`);
  }

  console.log('\nDone! CSVs written to public/data/');
}

main().catch(err => { console.error(err); process.exit(1); });
