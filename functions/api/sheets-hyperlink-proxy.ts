import { csvResponse } from './_csvParser';

function decodeGoogleRedirectUrl(href: string): string {
  if (href.includes('google.com/url') || href.includes('google.com/url?')) {
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

  try {
    const res = await fetch(sheetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sheet', status: res.status }),
        { status: res.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const html = await res.text();
    const allRows: string[][] = [];

    const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    for (const rowMatch of rowMatches) {
      const rowHtml = rowMatch[1];
      const cells: string[] = [];

      const cellMatches = rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
      for (const cellMatch of cellMatches) {
        const cellHtml = cellMatch[1];

        // Collect all hrefs in this cell (handles multiple links per cell)
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

      if (cells.some(c => c.trim() !== '')) {
        allRows.push(cells);
      }
    }

    if (allRows.length < 2) return csvResponse([]);

    const headers = allRows[0];
    const objects: Record<string, string>[] = allRows.slice(1).map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] ?? '';
      });
      return obj;
    });

    return csvResponse(objects);
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch or parse sheet' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
