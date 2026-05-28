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
  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
      const cellHtml = cellMatch[1];
      const hrefMatches = [...cellHtml.matchAll(/\shref="([^"]+)"/gi)];
      if (hrefMatches.length > 0) {
        const hrefs = hrefMatches
          .map(m => decodeHtmlEntities(decodeGoogleRedirectUrl(m[1])).trim())
          .filter(h => h && !h.startsWith('#') && !h.startsWith('javascript:'));
        cells.push(hrefs.join('\n'));
      } else {
        cells.push(decodeHtmlEntities(
          cellHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
        ));
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

  if (!sheetUrl || !sheetUrl.startsWith('https://docs.google.com/spreadsheets/')) {
    return new Response(JSON.stringify({ error: 'Invalid or missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

  const gidParam = gid ? `&gid=${gid}` : '';

  // 1. Standard CSV export — works for any publicly link-shared sheet
  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gidParam}`;
  try {
    const res = await fetch(csvUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const text = await res.text();
      // If we got an HTML redirect to Google login the response isn't CSV — skip it
      if (!text.trimStart().startsWith('<')) {
        const rows = parseCSV(text);
        if (rows.length > 0) {
          // 2. Also try gviz HTML to upgrade plain-URL values with real hyperlinks
          const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:html${gidParam}`;
          try {
            const gvizRes = await fetch(gvizUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (gvizRes.ok) {
              const html = await gvizRes.text();
              const htmlRows = parseHtmlTable(html);
              if (htmlRows.length > 0) return csvResponse(htmlRows);
            }
          } catch {}
          // gviz failed or unavailable — return plain CSV rows
          return csvResponse(rows);
        }
      }
    }
  } catch {}

  return csvResponse([]);
};
