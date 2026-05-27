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

export const onRequestGet: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const csvUrl = `${url.origin}/data/unreleased.csv`;

    const res = await fetch(csvUrl);
    if (!res.ok) return new Response('CSV not found', { status: 404 });

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
      const links = (row['Link(s)'] ?? '').split('\n').map((l: string) => l.trim()).filter(Boolean);

      eras[eraName].data['Unreleased Tracks'].push({
        name,
        extra: extra ?? undefined,
        description: row['Notes'] ?? '',
        track_length: row['Track Length'] ?? '',
        file_date: row['File Date'] ?? '',
        leak_date: row['Leak Date'] ?? '',
        available_length: row['Available Length'] ?? '',
        quality: row['Quality'] ?? '',
        url: links[0] ?? '',
        urls: links,
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
