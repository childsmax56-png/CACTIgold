// Run this in script.google.com as a STANDALONE project (not bound to any sheet).
// The sheet must be set to "Anyone with link can view".
// After running, find "cactigold_links.json" in your Google Drive and download it.

function extractCACTILinks() {
  const SHEET_ID = '1gJqbQrb3dIWF-PLMsKkNUrftpQb8zxsZFDAIpSvT5Fo';
  const ss = SpreadsheetApp.openById(SHEET_ID);

  const SHEET_NAMES = ['Unreleased', 'Released', 'Stems', 'Fakes', 'Tracklists'];
  const output = {};

  for (const sheetName of SHEET_NAMES) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) { Logger.log('Sheet not found: ' + sheetName); continue; }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) continue;

    Logger.log(`Processing ${sheetName}: ${lastRow} rows, ${lastCol} cols`);

    const range          = sheet.getRange(1, 1, lastRow, lastCol);
    const values         = range.getValues();
    const richTextValues = range.getRichTextValues();

    const rows = [];

    for (let r = 0; r < lastRow; r++) {
      const rowLinks = {};

      for (let c = 0; c < lastCol; c++) {
        const rtv = richTextValues[r][c];
        if (!rtv) continue;

        const urls = [];

        // 1) Cell-level hyperlink (Ctrl+K on entire cell)
        const cellUrl = rtv.getLinkUrl();
        if (cellUrl) {
          urls.push(cellUrl);
        } else {
          // 2) Per-run hyperlinks (multiple links within one cell)
          for (const run of rtv.getRuns()) {
            const url = run.getLinkUrl();
            if (url) urls.push(url);
          }
        }

        if (urls.length) rowLinks[c] = urls.length === 1 ? urls[0] : urls;
      }

      // Always include the header row; include data rows only if they have links
      if (r === 0 || Object.keys(rowLinks).length) {
        rows.push({ row: r + 1, values: values[r], links: rowLinks });
      }
    }

    output[sheetName] = rows;
    Logger.log(`  → ${rows.length - 1} rows with links found`);
  }

  // Delete any previous output file so we don't accumulate copies
  const existing = DriveApp.getFilesByName('cactigold_links.json');
  while (existing.hasNext()) existing.next().setTrashed(true);

  const file = DriveApp.createFile(
    'cactigold_links.json',
    JSON.stringify(output, null, 2),
    MimeType.PLAIN_TEXT
  );

  Logger.log('✅ Done! Download the file from Google Drive:');
  Logger.log(file.getUrl());
}
