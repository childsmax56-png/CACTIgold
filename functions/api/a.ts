import { parseCSV, csvResponse } from './_csvParser';

function parseSongName(raw: string): { name: string; extra: string | undefined } {
  const newline = raw.indexOf('\n');
  if (newline === -1) return { name: raw.trim(), extra: undefined };
  const name = raw.substring(0, newline).trim();
  const extra = raw.substring(newline).trim().replace(/^\n+/, '') || undefined;
  return { name, extra };
}

const ERA_NAME_MAP: Record<string, string> = {
  'The Graduates*':   'The Graduates',
  'The Classmates*':  'The Classmates',
  'Owl Pharaoh*':     'Owl Pharaoh',
  'Days Before Rodeo*': 'Days Before Rodeo',
  'Rodeo*':           'Rodeo',
  'Birds*':           'Birds',
  'Astroworld*':      'Astroworld',
  'JackBoys*':        'JackBoys',
  'Utopia [P1]*':     'Utopia [P1]',
  'Utopia [P2]*':     'Utopia [P2]',
  'JackBoys 2*':      'JackBoys 2',
  'Post-Utopia*':     'Post-Utopia',
  'Utopia':           'Utopia [P2]',
};

function mapEraName(name: string): string {
  return ERA_NAME_MAP[name.trim()] ?? name.trim();
}

const ERA_ORDER = [
  'The Graduates',
  'The Classmates',
  'Owl Pharaoh',
  'Days Before Rodeo',
  'Rodeo',
  'Birds',
  'Huncho Jack, Jack Huncho',
  'Astroworld',
  'JackBoys',
  'The Scotts',
  'Utopia [P1]',
  'Utopia [P2]',
  'JackBoys 2',
  'Post-Utopia',
  'Unknown',
];

type LinksRow = { row: number; values: string[]; links: Record<string, string> };

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const csvUrl = `${url.origin}/data/unreleased.csv`;
    const linksUrl = `${url.origin}/data/links.json`;

    const [res, linksRes] = await Promise.all([fetch(csvUrl), fetch(linksUrl)]);
    if (!res.ok) return new Response('CSV not found', { status: 404 });

    // Build era+title → real URL lookup from the hyperlinks JSON
    const normalize = (s: string) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const linksLookup = new Map<string, string>();
    if (linksRes.ok) {
      const linksData = await linksRes.json() as Record<string, LinksRow[]>;
      for (const row of linksData['Unreleased'] ?? []) {
        const era = mapEraName(normalize(row.values[0] ?? ''));
        const title = normalize(row.values[1] ?? '');
        const realUrl = row.links['9'] ?? row.links['8'] ?? '';
        if (era && title && realUrl) {
          linksLookup.set(`${era}:::${title}`.toLowerCase(), realUrl);
        }
      }
    }

    const text = await res.text();
    const rows = parseCSV(text);

    const eras: Record<string, any> = {};

    for (const row of rows) {
      const eraRaw = row['Era'] ?? '';
      const nameRaw = row['Name'] ?? '';
      if (!eraRaw || !nameRaw) continue;

      const eraName = mapEraName(eraRaw);
      if (!eras[eraName]) {
        eras[eraName] = { name: eraName, data: { 'Unreleased Tracks': [] } };
      }

      const { name, extra } = parseSongName(nameRaw);
      const csvLinks = (row['Link(s)'] ?? '').split('\n').map((l: string) => l.trim()).filter(Boolean);
      const lookupKey = `${eraName}:::${normalize(nameRaw)}`.toLowerCase();
      const realUrl = linksLookup.get(lookupKey) ?? csvLinks[0] ?? '';
      const urls = realUrl ? [realUrl] : csvLinks;

      eras[eraName].data['Unreleased Tracks'].push({
        name,
        extra: extra ?? undefined,
        description: row['Notes'] ?? '',
        track_length: row['Track Length'] ?? '',
        file_date: row['File Date'] ?? '',
        leak_date: row['Leak Date'] ?? '',
        available_length: row['Available Length'] ?? '',
        quality: row['Quality'] ?? '',
        url: realUrl,
        urls,
      });
    }

    const orderedEras: Record<string, any> = {};
    for (const name of ERA_ORDER) {
      if (eras[name]) orderedEras[name] = eras[name];
    }
    for (const name of Object.keys(eras)) {
      if (!orderedEras[name]) orderedEras[name] = eras[name];
    }

    const trackerData = {
      name: 'CACTIgold',
      tabs: ['eras'],
      current_tab: 'eras',
      eras: orderedEras,
    };

    return csvResponse(trackerData);
  } catch (err) {
    return new Response('Failed to build tracker data', { status: 500 });
  }
};
