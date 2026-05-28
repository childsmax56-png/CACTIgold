// Download the music tab (first sheet) as a structured era/song JSON
function downloadSsAGeparatelyFast() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allTabNames = ss.getSheets().map(s => s.getName());

  const sheet = ss.getSheets()[0];
  const range = sheet.getDataRange();

  const sheetData = {
    name: sheet.getName(),
    values: range.getValues(),
    formulas: range.getFormulas(),
    backgrounds: range.getBackgrounds(),
    fontColors: range.getFontColors()
  };

  const htmlContent = `
    <html>
    <body style="font-family: sans-serif; text-align: center; padding: 20px;">
      <h3 id="status">Loading...</h3>
      <p id="sub">Please don't close this window.</p>
      <pre id="errbox" style="text-align:left;color:red;font-size:11px;max-height:200px;overflow:auto;display:none;"></pre>
      <script>
        function showError(e) {
          document.getElementById("status").textContent = "Error!";
          const box = document.getElementById("errbox");
          box.style.display = "block";
          box.textContent = String(e);
        }

        const sheetData       = ${JSON.stringify(sheetData)};
        const spreadsheetName = ${JSON.stringify(ss.getName())};
        const allTabNames     = ${JSON.stringify(allTabNames)};

        function parseImageUrl(formula) {
          if (!formula) return "";
          const patterns = [
            new RegExp('IMAGE\\s*\\(\\s*"([^"]+)"', 'i'),
            new RegExp("IMAGE\\s*\\(\\s*'([^']+)'", 'i'),
            new RegExp('IMAGE\\s*\\(\\s*([^,\\)]+)', 'i')
          ];
          for (const p of patterns) {
            const m = formula.match(p);
            if (m) return m[1].trim().replace(/^["']|["']$/g, "");
          }
          return "";
        }

        function formatDate(val) {
          if (val === "" || val === null || val === undefined) return "";
          const d = new Date(val);
          if (isNaN(d.getTime())) return String(val);
          return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }

        function splitNameExtra(raw) {
          const lines = String(raw || "").split("\\n").map(l => l.trim()).filter(Boolean);
          return { name: lines[0] || "", extra: lines.slice(1).join(" ") || "" };
        }

        function parseUrls(raw) {
          if (!raw) return { url: "", urls: [] };
          const urls = String(raw).split("\\n").map(u => u.trim()).filter(Boolean);
          return { url: urls[0] || "", urls };
        }

        function isEraHeader(eraVal) {
          return String(eraVal || "").includes("OG File");
        }

        function isSubSectionHeader(row, iQual, iLinks, iAvail, iName) {
          const nameVal = iName >= 0 ? String(row[iName] || "").trim() : "";
          if (!nameVal) return false;
          const quality = iQual  >= 0 ? String(row[iQual]  || "").trim() : "";
          const link    = iLinks >= 0 ? String(row[iLinks] || "").trim() : "";
          const avail   = iAvail >= 0 ? String(row[iAvail] || "").trim() : "";
          return quality === "" && link === "" && avail === "";
        }

        function extractImageUrl(row, fRow, iFDate) {
          let image = "";

          if (iFDate >= 0 && fRow[iFDate]) {
            image = parseImageUrl(fRow[iFDate]);
          }
          if (!image) {
            for (let ci = 0; ci < fRow.length; ci++) {
              if (fRow[ci] && String(fRow[ci]).toUpperCase().includes("IMAGE")) {
                image = parseImageUrl(fRow[ci]);
                if (image) break;
              }
            }
          }

          if (!image) {
            const httpPattern = new RegExp("^https?://");
            for (let ci = 0; ci < row.length; ci++) {
              const val = String(row[ci] || "").trim();
              if (httpPattern.test(val)) {
                image = val;
                break;
              }
            }
          }

          return image;
        }

        async function processAndDownload() {
          try {
            const sheet       = sheetData;
            const headers     = sheet.values[0].map(h => String(h || "").trim());
            const rows        = sheet.values.slice(1);
            const formulas    = (sheet.formulas    || []).slice(1);
            const backgrounds = (sheet.backgrounds || []).slice(1);
            const fontColors  = (sheet.fontColors  || []).slice(1);

            const findCol = (...names) => {
              for (const n of names) {
                const idx = headers.findIndex(h => h.toLowerCase().includes(n.toLowerCase()));
                if (idx >= 0) return idx;
              }
              return -1;
            };

            const iEra   = findCol("Era");
            const iName  = findCol("Name");
            const iNotes = findCol("Notes");
            const iTLen  = findCol("Track Length");
            const iFDate = findCol("File Date");
            const iLDate = findCol("Leak Date");
            const iAvail = findCol("Available Length");
            const iQual  = findCol("Quality");
            const iLinks = findCol("Link");

            document.getElementById("sub").textContent =
              "Columns: Era=" + iEra + " Name=" + iName + " FileDate=" + iFDate;

            const eras = {};
            let currentEraKey     = null;
            let currentSubSection = "Default";

            for (let i = 0; i < rows.length; i++) {
              const row  = rows[i]        || [];
              const fRow = formulas[i]    || [];
              const bg   = backgrounds[i] || [];
              const fc   = fontColors[i]  || [];

              if (row.every(c => c === "" || c === null || c === undefined)) continue;

              const eraVal  = iEra  >= 0 ? row[iEra]  : "";
              const nameVal = iName >= 0 ? row[iName] : "";

              if (isEraHeader(eraVal)) {
                const { name: eraName, extra: eraExtra } = splitNameExtra(nameVal);
                const fileInfo = String(eraVal).split("\\n").map(s => s.trim()).filter(Boolean);
                const timeline = iNotes >= 0 ? String(row[iNotes] || "").replace(/\\n/g, "") : "";

                const image    = extractImageUrl(row, fRow, iFDate);
                const bgColor  = iName >= 0 ? (bg[iName] || "") : "";
                const txtColor = iName >= 0 ? (fc[iName] || "") : "";

                currentEraKey     = eraName;
                currentSubSection = "Default";

                eras[eraName] = {
                  name: eraName, extra: eraExtra, timeline, fileInfo,
                  image, backgroundColor: bgColor, textColor: txtColor,
                  data: { Default: [] }
                };

              } else {
                if (eraVal && String(eraVal) !== currentEraKey) {
                  currentEraKey     = String(eraVal);
                  currentSubSection = "Default";
                  if (!eras[currentEraKey]) {
                    eras[currentEraKey] = {
                      name: currentEraKey, extra: "", timeline: "", fileInfo: [],
                      image: "", backgroundColor: "", textColor: "", data: { Default: [] }
                    };
                  }
                }
                if (!currentEraKey) continue;

                const { name: songName, extra: songExtra } = splitNameExtra(nameVal);

                if (isSubSectionHeader(row, iQual, iLinks, iAvail, iName)) {
                  currentSubSection = songName || ("Section_" + i);
                  if (!eras[currentEraKey].data[currentSubSection]) {
                    eras[currentEraKey].data[currentSubSection] = [];
                  }
                  if (iNotes >= 0 && row[iNotes]) {
                    const sectionTimeline = String(row[iNotes] || "").replace(/\\n/g, "");
                    eras[currentEraKey]["timeline_" + currentSubSection] = sectionTimeline;
                  }

                } else {
                  if (!eras[currentEraKey].data[currentSubSection]) {
                    eras[currentEraKey].data[currentSubSection] = [];
                  }

                  const { url, urls } = iLinks >= 0 ? parseUrls(row[iLinks]) : { url: "", urls: [] };

                  eras[currentEraKey].data[currentSubSection].push({
                    name: songName, extra: songExtra,
                    description:      iNotes >= 0 ? String(row[iNotes] || "").replace(/\\n/g, " ") : "",
                    track_length:     iTLen  >= 0 ? String(row[iTLen]  || "") : "",
                    leak_date:        iLDate >= 0 ? formatDate(row[iLDate]) : "",
                    file_date:        iFDate >= 0 ? formatDate(row[iFDate]) : "",
                    available_length: iAvail >= 0 ? String(row[iAvail] || "") : "",
                    quality:          iQual  >= 0 ? String(row[iQual]  || "") : "",
                    url, urls
                  });
                }
              }
            }

            const output = {
              name: spreadsheetName,
              tabs: allTabNames,
              current_tab: sheet.name,
              eras
            };

            const blob = new Blob([JSON.stringify(output)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = sheet.name.replace(/[\/\\?%*:|"<>]/g, "-") + ".json";
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(a.href);
            a.remove();

            document.getElementById("status").textContent = "Done!";
            document.getElementById("sub").textContent = "You can close this window.";
            setTimeout(() => google.script.host.close(), 2000);

          } catch(e) {
            showError(e);
          }
        }

        processAndDownload();
      </script>
    </body>
    </html>
  `;

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(htmlContent).setWidth(460).setHeight(200),
    'Loading...'
  );
}

// Download all other tabs (recent, mv, etc.) as simple key-value JSON arrays
function downloadSeAApdaratelyFast() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  const sheetData = sheets.map(s => {
    return {
      name: s.getName().replace(/[/\\?%*:|"<>]/g, '-'),
      values: s.getDataRange().getValues()
    };
  });

  const htmlContent = `
    <html>
    <body style="font-family: sans-serif; text-align: center;">
      <h3>Processing ${sheetData.length} tabs...</h3>
      <p>Please don't close this window, the download will start in a moment.</p>
      <script>
        const rawData = ${JSON.stringify(sheetData)};

        async function processAndDownload() {
          for (const sheet of rawData) {
            const headers = sheet.values[0];
            const rows = sheet.values.slice(1);

            const json = rows.map(row => {
              const obj = {};
              headers.forEach((key, i) => { if (key) obj[key] = row[i]; });
              return obj;
            });

            const blob = new Blob([JSON.stringify(json)], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = sheet.name + ".json";
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);

            await new Promise(r => setTimeout(r, 500));
          }
          google.script.host.close();
        }
        processAndDownload();
      </script>
    </body>
    </html>
  `;

  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(400)
    .setHeight(200);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Downloading Files...');
}

// Export the active sheet as recent.csv with real hyperlink URLs extracted.
// Run this from Extensions > Apps Script > Run > exportRecentCsv
function exportRecentCsv() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('Sheet appears empty.');
    return;
  }

  const values    = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const richText  = sheet.getRange(1, 1, lastRow, lastCol).getRichTextValues();

  // Row 0 = headers
  const headers = values[0].map(h => String(h).trim());
  const eraIdx   = headers.findIndex(h => h.toLowerCase() === 'era');
  const linksIdx = headers.findIndex(h => h.toLowerCase() === 'links' || h.toLowerCase().startsWith('link'));

  function csvEscape(val) {
    const s = String(val == null ? '' : val);
    return (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r'))
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  }

  const csvRows = [headers.map(csvEscape).join(',')];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    // Skip rows where Era is empty (merged description rows, blank spacers, etc.)
    if (eraIdx >= 0 && String(row[eraIdx]).trim() === '') continue;
    if (row.every(c => String(c).trim() === '')) continue;

    const cells = row.map((cell, c) => {
      if (c === linksIdx) {
        // Prefer the real hyperlink URL over the display text
        const rt = richText[r][c];
        const url = rt ? rt.getLinkUrl() : null;
        return csvEscape(url || cell);
      }
      return csvEscape(cell);
    });
    csvRows.push(cells.join(','));
  }

  const csv = csvRows.join('\n');

  const html = `<html><body style="font-family:sans-serif;text-align:center;padding:20px;">
    <h3 id="msg">Downloading recent.csv…</h3>
    <script>
      const content = ${JSON.stringify(csv)};
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([content], {type:'text/csv'}));
      a.download = 'recent.csv';
      document.body.appendChild(a);
      a.click();
      document.getElementById('msg').textContent = 'Done! You can close this window.';
      setTimeout(() => google.script.host.close(), 2000);
    </script>
  </body></html>`;

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(380).setHeight(160),
    'Exporting recent.csv'
  );
}
