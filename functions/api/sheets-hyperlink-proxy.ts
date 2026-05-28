import { parseCSV, csvResponse } from './_csvParser';

function decodeGoogleRedirectUrl(href: string): string {
  if (href.includes('google.com/url')) {
    const match = href.match(/[?&]q=([^&"]+)/);
    if (match) {
      try { return decodeURIComponent(match[1]); } catch {}
    }
  }
  return href;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

function parseHtmlTable(html: string): Record<string, string>[] {
  const allRows: string[][] = [];

  const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const rowMatch of rowMatches) {
    const cells: string[] = [];
    const cellMatches = rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    for (const cellMatch of cellMatches) {
      const cellHtml = cellMatch[1];
      const hrefMatches = [...cellHtml.matchAll(/\shref="([^"]+)"/gi)];
      if (hrefMatches.length > 0) {
        const hrefs = hrefMatches
          .map(m => {
            let href = m[1];
            href = decodeGoogleRedirectUrl(href);
            href = decodeHtmlEntities(href);
            return href.trim();
          })
          .filter(h => h && !h.startsWith('#') && !h.startsWith('javascript:'));
        cells.push(hrefs.join('\n'));
      } else {
        const text = cellHtml
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .trim();
        cells.push(decodeHtmlEntities(text));
      }
    }
    if (cells.some(c => c.trim() !== '')) allRows.push(cells);
  }

  if (allRows.length < 2) return [];

  const headers = allRows[0];
  return allRows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
    return obj;
  });
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const sheetUrl = url.searchParams.get('url');

  if (!sheetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!sheetUrl.startsWith('https://docs.google.com/spreadsheets/')) {
    return new Response(JSON.stringify({ error: 'Only Google Sheets URLs are allowed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Extract spreadsheet ID and optional gid from the incoming URL
  const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const gidMatch = sheetUrl.match(/[#&?]gid=(\d+)/);
  const spreadsheetId = idMatch?.[1];
  const gid = gidMatch?.[1] ?? null;

  if (!spreadsheetId) {
    return new Response(JSON.stringify({ error: 'Could not parse spreadsheet ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. Try gviz HTML (works unauthenticated for public sheets, preserves hyperlinks)
  const gvizHtmlUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:html${gid ? `&gid=${gid}` : ''}`;
  try {
    const res = await fetch(gvizHtmlUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const html = await res.text();
      const rows = parseHtmlTable(html);
      if (rows.length > 0) return csvResponse(rows);
    }
  } catch {}

  // 2. Fall back to standard CSV export (no hyperlink support but reliably public)
  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
  try {
    const res = await fetch(csvUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const text = await res.text();
      const rows = parseCSV(text);
      if (rows.length > 0) return csvResponse(rows);
    }
  } catch {}

  return csvResponse([]);
};
