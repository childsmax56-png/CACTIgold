interface Env {
  KV: KVNamespace;
  SHEET_ID: string;
  DISCORD_WEBHOOK_URL: string;
  DISCORD_BOT_TOKEN: string;
}

// Tabs to watch: [label, gid]. gid="" means the first/default tab.
const WATCHED_TABS = [
  { label: "Unreleased", gid: "" },
  { label: "Recent", gid: "1385926980" },
];

function csvUrl(sheetId: string, gid: string) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
}

function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { current.push(field); field = ""; }
      else if (ch === "\n") { current.push(field); field = ""; rows.push(current); current = []; }
      else if (ch !== "\r") { field += ch; }
    }
  }
  if (field || current.length > 0) { current.push(field); rows.push(current); }
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1)
    .filter(row => row.some(cell => cell.trim() !== ""))
    .map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (row[i] ?? "").trim(); });
      return obj;
    });
}

function rowKey(row: Record<string, string>): string {
  // Identify a row by Era + Name (adjust if your sheet uses different column names)
  return `${row["Era"] ?? ""}||${row["Name"] ?? row["Song"] ?? ""}`;
}

function describeRow(row: Record<string, string>): string {
  const era = row["Era"] || row["Album"] || "";
  const name = row["Name"] || row["Song"] || "(unknown)";
  const quality = row["Quality"] || row["Available Length"] || "";
  const link = row["Link(s)"] || row["Link"] || "";
  let desc = `**${name}**`;
  if (era) desc += ` — ${era}`;
  if (quality) desc += ` (${quality})`;
  if (link) desc += `\n<${link.split(",")[0].trim()}>`;
  return desc;
}

async function sendDiscord(webhookUrl: string, content: string, botToken?: string) {
  const url = botToken ? `${webhookUrl}?wait=true` : webhookUrl;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!botToken) return;

  const msg = await res.json() as { id: string; channel_id: string };
  if (!msg.id || !msg.channel_id) return;

  await fetch(`https://discord.com/api/v10/channels/${msg.channel_id}/messages/${msg.id}/crosspost`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}` },
  });
}

async function watchTab(
  env: Env,
  sheetId: string,
  tab: { label: string; gid: string }
) {
  const url = csvUrl(sheetId, tab.gid);
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) return;

  const text = await res.text();
  const rows = parseCSV(text);
  const kvKey = `rows:${tab.label}`;

  const storedJson = await env.KV.get(kvKey);
  const stored: Set<string> = storedJson
    ? new Set(JSON.parse(storedJson) as string[])
    : new Set();

  const current = new Map(rows.map(r => [rowKey(r), r]));
  const currentKeys = new Set(current.keys());

  // First run — just store state, don't alert
  if (!storedJson) {
    await env.KV.put(kvKey, JSON.stringify([...currentKeys]));
    return;
  }

  const newRows = [...current.entries()]
    .filter(([k]) => !stored.has(k))
    .map(([, row]) => row);

  if (newRows.length === 0) return;

  const descriptions = newRows.map(describeRow).join("\n\n");
  const plural = newRows.length === 1 ? "entry" : "entries";
  const message = `🆕 **${newRows.length} new ${plural} on the ${tab.label} tab:**\n\n${descriptions}`;

  await sendDiscord(env.DISCORD_WEBHOOK_URL, message, env.DISCORD_BOT_TOKEN);
  await env.KV.put(kvKey, JSON.stringify([...currentKeys]));
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    await Promise.all(WATCHED_TABS.map(tab => watchTab(env, env.SHEET_ID, tab)));
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.searchParams.get("test") !== "true") {
      return new Response("Not found", { status: 404 });
    }
    await sendDiscord(env.DISCORD_WEBHOOK_URL, "✅ Sheet watch worker is live and connected!", env.DISCORD_BOT_TOKEN);
    return new Response("Test message sent to Discord.", { status: 200 });
  },
};
