const sizes = ["2XS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "OS"];

// Parses a box input string like "M-10" or "S-10,M-5" into [{size, qty}, ...].
// A bare number like "10" (no size code) is treated as OS-10 (One Size).
// Returns null if any part is invalid.
function parseBoxInput(input) {
  const parts = input.split(",");
  const items = [];

  for (const part of parts) {
    let size, qtyStr;

    if (/^\d+$/.test(part)) {
      size = "OS";
      qtyStr = part;
    } else {
      [size, qtyStr] = part.split("-");
      if (size === "ONESIZE" || size === "ONE SIZE") size = "OS";
    }

    const qty = parseInt(qtyStr, 10);

    if (!sizes.includes(size) || isNaN(qty) || qty <= 0) {
      return null;
    }
    items.push({ size, qty });
  }

  return items;
}
let allStyleEntries = {}; // { styleName: { summary: {}, logEntries: [] } }

function initializeStyleData(style) {
  if (!allStyleEntries[style]) {
    allStyleEntries[style] = {
      summary: Object.fromEntries(
        sizes.map((size) => [size, { qty: 0, count: 0 }]),
      ),
      logEntries: [],
    };
  }
}

function saveToStorage() {
  localStorage.setItem("allStyleEntries", JSON.stringify(allStyleEntries));
}

function loadFromStorage() {
  const stored = localStorage.getItem("allStyleEntries");
  if (stored) {
    allStyleEntries = JSON.parse(stored);
  }
}

function emptySummary() {
  return Object.fromEntries(sizes.map((size) => [size, { qty: 0, count: 0 }]));
}

function rebuildStyleSummary(style) {
  const data = allStyleEntries[style];
  if (!data) return;

  // reset summary
  data.summary = emptySummary();

  // rebuild from log
  data.logEntries.forEach((entry) => {
    if (entry.items) {
      // add qty for each size
      entry.items.forEach(({ size, qty }) => {
        data.summary[size].qty += qty;
      });
      // your existing count logic: count only on first size
      if (entry.items.length > 0) {
        data.summary[entry.items[0].size].count += 1;
      }
    } else {
      // legacy single entry support
      data.summary[entry.size].qty += entry.qty;
      data.summary[entry.size].count += 1;
    }
  });
}

function renderAllStyles() {
  const container = document.getElementById("all-styles-container");
  container.innerHTML = "";

  if (Object.keys(allStyleEntries).length === 0) {
    container.innerHTML = "<p>No data yet.</p>";
    return;
  }

  for (const [style, data] of Object.entries(allStyleEntries)) {
    const section = document.createElement("div");
    section.className = "style-section";

    const title = document.createElement("h3");
    title.innerText = `Style: ${style}`;
    section.appendChild(title);

    // Summary Table
    const summaryTable = document.createElement("table");
    summaryTable.className = "summary-table";
    summaryTable.innerHTML = `<tr><th>Size</th><th>Qty</th><th>Count</th></tr>`;

    let totalBoxes = 0;
    sizes.forEach((size) => {
      const { qty, count } = data.summary[size] || { qty: 0, count: 0 };
      totalBoxes += count;
      const row = document.createElement("tr");
      row.innerHTML = `<td>${size}</td><td>${qty}</td><td>${count}</td>`;
      summaryTable.appendChild(row);
    });

    const boxTotal = document.createElement("p");
    boxTotal.innerText = `Total Boxes: ${totalBoxes}`;

    // Log Button
    const logToggleBtn = document.createElement("button");
    logToggleBtn.innerText = "View Log";
    logToggleBtn.className = "toggle-log-btn";
    logToggleBtn.onclick = () => showLogModal(style);

    // ✅ PDF Export Button
    const pdfBtn = document.createElement("button");
    pdfBtn.innerText = "Export Labels (PDF)";
    pdfBtn.className = "toggle-log-btn"; // reuse visible styling
    pdfBtn.onclick = () => exportStyleLabelsToPDF(style);

    section.appendChild(summaryTable);
    section.appendChild(boxTotal);
    section.appendChild(logToggleBtn);
    section.appendChild(pdfBtn); // ✅ append it

    container.appendChild(section);
  }
}

// Add entry handler supports mixed boxes input format:
// Either "M-10" (single size) or "M5,L5" (mixed sizes)
function addEntry() {
  const input = document
    .getElementById("entryInput")
    .value.trim()
    .toUpperCase();
  const style = document
    .getElementById("styleInput")
    .value.trim()
    .toUpperCase();

  if (!input || !style) {
    alert(
      "Please enter a style and size-quantity (e.g. M-10, S-10,M-5, or 10 for One Size).",
    );
    return;
  }

  initializeStyleData(style);

  const items = parseBoxInput(input);

  if (!items) {
    alert(
      "Invalid entry. Use format SIZE-QUANTITY (e.g. M-10), multiple like S-10,M-5, OS-10 for One Size, or just a number (e.g. 10) for One Size.",
    );
    return;
  }

  // Add quantities per size
  items.forEach(({ size, qty }) => {
    allStyleEntries[style].summary[size].qty += qty;
  });

  // Increase box count by 1 for the whole mixed box
  items.forEach(({ size }) => {
    // Only increment count once per box, so do this only for the first size
    // We'll increment count only once total below instead
  });
  // Increment box count once per box (not per size)
  allStyleEntries[style].summary[items[0].size].count += 1;

  // Log the whole mixed box as one entry
  allStyleEntries[style].logEntries.push({
    id: crypto.randomUUID(),
    ts: Date.now(),
    items,
  });

  saveToStorage();
  renderAllStyles();

  document.getElementById("entryInput").value = "";
  document.getElementById("entryInput").focus();
}

function deleteLogEntry(style, entryId) {
  const data = allStyleEntries[style];
  if (!data) return;

  data.logEntries = data.logEntries.filter((e) => e.id !== entryId);

  rebuildStyleSummary(style);
  saveToStorage();
  renderAllStyles();
  showLogModal(style); // refresh modal view
}

function editLogEntry(style, entryId) {
  const data = allStyleEntries[style];
  if (!data) return;

  const entry = data.logEntries.find((e) => e.id === entryId);
  if (!entry) return;

  // Build a string like "S-10,M-5" from the existing entry
  const current = entry.items
    ? entry.items.map((i) => `${i.size}-${i.qty}`).join(",")
    : `${entry.size}-${entry.qty}`;

  const next = prompt(
    "Edit this box. Use format like M-10, S-10,M-5, or 10 for One Size",
    current,
  );
  if (next === null) return; // user cancelled

  const input = next.trim().toUpperCase();
  if (!input) {
    alert("Entry cannot be empty.");
    return;
  }

  const items = parseBoxInput(input);

  if (!items) {
    alert(
      "Invalid entry. Use format SIZE-QUANTITY like M-10, S-10,M-5, OS-10, or just a number (e.g. 10) for One Size.",
    );
    return;
  }

  // Apply updated entry (store as mixed-box format)
  entry.items = items;
  delete entry.size;
  delete entry.qty;

  rebuildStyleSummary(style);
  saveToStorage();
  renderAllStyles();
  showLogModal(style);
}

// Undo last entry for a style
function undoLast() {
  const style = document
    .getElementById("styleInput")
    .value.trim()
    .toUpperCase();
  if (!style || !allStyleEntries[style]) {
    alert("No entries for this style to undo.");
    return;
  }

  const log = allStyleEntries[style].logEntries;
  if (log.length === 0) {
    alert("No entries to undo.");
    return;
  }

  // Remove last entry
  const lastEntry = log.pop();

  // lastEntry might be a mixed box with 'items' array or a single size-qty
  if (lastEntry.items) {
    // Mixed box undo
    lastEntry.items.forEach(({ size, qty }, index) => {
      allStyleEntries[style].summary[size].qty -= qty;
      // Remove 1 box count only once (on first size)
      if (index === 0) {
        allStyleEntries[style].summary[size].count -= 1;
      }
    });
  } else {
    // Single size-qty undo
    const { size, qty } = lastEntry;
    allStyleEntries[style].summary[size].qty -= qty;
    allStyleEntries[style].summary[size].count -= 1;
  }

  saveToStorage();
  renderAllStyles();
}

// Show modal popup for logs
function showLogModal(style) {
  const modal = document.getElementById("logModal");
  const overlay = document.getElementById("modalOverlay");
  const tbody = document.querySelector("#modalLogTable tbody");

  tbody.innerHTML = "";

  const data = allStyleEntries[style];
  if (!data || data.logEntries.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3; // <-- changed to 3 because we have Actions column
    cell.innerText = "No log entries";
    row.appendChild(cell);
    tbody.appendChild(row);

    modal.style.display = "block";
    overlay.style.display = "block";
    return;
  }

  const sortedLogEntries = [...data.logEntries].sort((a, b) => {
    const getIndex = (entry) => {
      if (entry.items && entry.items.length > 0) {
        return sizes.indexOf(entry.items[0].size);
      }
      return sizes.indexOf(entry.size);
    };
    return getIndex(a) - getIndex(b);
  });

  sortedLogEntries.forEach((entry) => {
    const row = document.createElement("tr");

    const sizeCell = document.createElement("td");
    const qtyCell = document.createElement("td");
    const actionsCell = document.createElement("td");

    if (entry.items) {
      const sortedItems = [...entry.items].sort(
        (a, b) => sizes.indexOf(a.size) - sizes.indexOf(b.size),
      );
      sizeCell.innerText = sortedItems.map((i) => i.size).join(", ");
      qtyCell.innerText = sortedItems.map((i) => i.qty).join(", ");
    } else {
      sizeCell.innerText = entry.size;
      qtyCell.innerText = entry.qty;
    }

    const editBtn = document.createElement("button");
    editBtn.innerText = "Edit";
    editBtn.onclick = () => editLogEntry(style, entry.id);

    const delBtn = document.createElement("button");
    delBtn.innerText = "Delete";
    delBtn.onclick = () => {
      if (confirm("Delete this log entry?")) {
        deleteLogEntry(style, entry.id);
      }
    };

    actionsCell.appendChild(editBtn);
    actionsCell.appendChild(document.createTextNode(" "));
    actionsCell.appendChild(delBtn);

    row.appendChild(sizeCell);
    row.appendChild(qtyCell);
    row.appendChild(actionsCell);

    tbody.appendChild(row);
  });

  modal.style.display = "block";
  overlay.style.display = "block";
}

function closeLogModal() {
  document.getElementById("logModal").style.display = "none";
  document.getElementById("modalOverlay").style.display = "none";
}

// Add event listener for your close button:
document.getElementById("closeModalBtn").onclick = closeLogModal;

// Also clicking on overlay closes modal
document.getElementById("modalOverlay").onclick = closeLogModal;

// Reset all data
function resetAll() {
  if (confirm("Are you sure you want to clear all data?")) {
    allStyleEntries = {};
    localStorage.removeItem("allStyleEntries");
    renderAllStyles();
    document.getElementById("entryInput").value = "";
    document.getElementById("styleInput").value = "";
  }
}

// Export Excel (same as before, adjusted for mixed boxes)
function exportToExcel() {
  const wb = XLSX.utils.book_new();

  // --- Helper to sanitize sheet names ---
  function sanitizeSheetName(name) {
    return name
      .replace(/[:\\/?*\[\]]/g, "") // remove invalid characters
      .substring(0, 31) // Excel allows max 31 chars
      .trim(); // remove leading/trailing spaces
  }

  for (const [style, data] of Object.entries(allStyleEntries)) {
    // --- Summary Sheet ---
    const summaryData = [["Size", "Qty", "Count"]];
    sizes.forEach((size) => {
      const { qty, count } = data.summary[size] || { qty: 0, count: 0 };
      summaryData.push([size, qty, count]);
    });
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(
      wb,
      summarySheet,
      sanitizeSheetName(`${style}_Summary`),
    );

    // --- Log Sheet ---
    const logData = [["Size", "Quantity"]];

    // Flatten and sort log entries by first size
    const sortedLogEntries = [...data.logEntries].sort((a, b) => {
      const getIndex = (entry) => {
        if (entry.items && entry.items.length > 0) {
          return sizes.indexOf(entry.items[0].size);
        }
        return sizes.indexOf(entry.size);
      };
      return getIndex(a) - getIndex(b);
    });

    sortedLogEntries.forEach((entry) => {
      if (entry.items) {
        // Sort items inside the mixed box
        const sortedItems = [...entry.items].sort(
          (a, b) => sizes.indexOf(a.size) - sizes.indexOf(b.size),
        );
        logData.push([
          sortedItems.map((i) => i.size).join(", "),
          sortedItems.map((i) => i.qty).join(", "),
        ]);
      } else {
        logData.push([entry.size, entry.qty]);
      }
    });

    const logSheet = XLSX.utils.aoa_to_sheet(logData);
    XLSX.utils.book_append_sheet(
      wb,
      logSheet,
      sanitizeSheetName(`${style}_Log`),
    );
  }

  XLSX.writeFile(wb, "carton_summary.xlsx");
}

function buildLabelsSheetForAllStyles() {
  const sheet = document.createElement("div");
  sheet.className = "pdf-sheet";

  const grid = document.createElement("div");
  grid.className = "pdf-label-grid";
  sheet.appendChild(grid);

  const styles = Object.keys(allStyleEntries || {});
  if (styles.length === 0) return null;

  styles.sort();

  // 1) Flatten all log entries across all styles first
  const flat = [];
  styles.forEach((style) => {
    const data = allStyleEntries[style];
    if (
      !data ||
      !Array.isArray(data.logEntries) ||
      data.logEntries.length === 0
    )
      return;

    data.logEntries.forEach((entry) => {
      flat.push({ style, entry });
    });
  });

  if (flat.length === 0) return null;

  const grandTotal = flat.length;

  // 2) Build labels with continuous carton numbers
  flat.forEach(({ style, entry }, index) => {
    const cartonNumber = index + 1;

    const label = document.createElement("div");
    label.className = "pdf-label";

    const items = (entry.items || [])
      .slice()
      .sort((a, b) => sizes.indexOf(a.size) - sizes.indexOf(b.size));

    label.innerHTML = `
      <div class="pdf-label-content">
        <div class="pdf-section">
          <strong>Supplier Address</strong><br>
          Sisters and Seekers Ltd<br>
          Unit 2/4 Vista Business Park<br>
          Ffordd Stephen Wade<br>
          Hawarden<br>
          CH5 3FN
        </div>

        <div class="pdf-section">
          <strong>Carton QTY:</strong>
          <div class="pdf-contents">
            ${items.map((i) => `<div class="pdf-box">${i.size} - ${i.qty}</div>`).join("")}
          </div>
        </div>

        <div class="pdf-section"><strong>Carton Number:</strong> ${cartonNumber}/${grandTotal}</div>
        <div class="pdf-section"><strong>Style:</strong> ${style}</div>
      </div>
    `;

    grid.appendChild(label);
  });

  return sheet;
}

async function exportAllLabelsToPDF() {
  loadFromStorage();

  // PO prompt (once)
  const po = prompt(
    "Enter PO Number for these labels:",
    localStorage.getItem("lastPO") || "",
  );
  if (po === null) return;
  const poClean = po.trim();
  if (!poClean) {
    alert("PO Number is required to export labels.");
    return;
  }
  localStorage.setItem("lastPO", poClean);

  const flat = buildFlatCartonsAcrossAllStyles();
  if (!flat.length) {
    alert("No logs found to export.");
    return;
  }

  const grandTotal = flat.length;

  // Batch prompt
  const defaultBatch = grandTotal > 100 ? 50 : grandTotal; // sensible default
  const batchStr = prompt(
    `You have ${grandTotal} labels.\n\n` +
      `Enter batch size (e.g. 50). Larger batches may fail in-browser.`,
    String(defaultBatch),
  );
  if (batchStr === null) return;

  let batchSize = parseInt(batchStr, 10);
  if (!Number.isFinite(batchSize) || batchSize <= 0) batchSize = defaultBatch;

  // Quality vs memory: 1.5 is a good sweet spot
  const CANVAS_SCALE = 1.5;

  showProgress();

  try {
    let batchStart = 0;
    let batchIndex = 1;

    while (batchStart < grandTotal) {
      const batchEnd = Math.min(batchStart + batchSize, grandTotal); // exclusive end
      const slice = flat.slice(batchStart, batchEnd);

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      });

      // offscreen wrapper for rendering label with your existing A4 CSS
      const exportWrapper = document.createElement("div");
      exportWrapper.style.position = "fixed";
      exportWrapper.style.left = "-9999px";
      exportWrapper.style.top = "0";
      exportWrapper.style.background = "#fff";
      document.body.appendChild(exportWrapper);

      for (let i = 0; i < slice.length; i++) {
        const globalIndex = batchStart + i; // 0-based overall
        const cartonNumber = globalIndex + 1; // 1-based
        const { style, entry } = slice[i];

        setProgress(cartonNumber, grandTotal, `Batch ${batchIndex}:`);

        const label = document.createElement("div");
        label.className = "label"; // uses your A4 label CSS

        const items = (entry.items || [])
          .slice()
          .sort((a, b) => sizes.indexOf(a.size) - sizes.indexOf(b.size));

        label.innerHTML = `
          <div class="label-content">
            <div class="label-section">
              <strong>Supplier Address</strong><br>
              Sisters and Seekers Ltd<br>
              Unit 2/4 Vista Business Park<br>
              Ffordd Stephen Wade<br>
              Hawarden<br>
              CH5 3FN
            </div>

            <div class="label-section"><strong>PO Number:</strong> ${poClean}</div>

            <div class="label-section">
              <strong>Carton QTY:</strong>
              <div class="out-contents">
                ${items.map((i) => `<div class="label-box">${i.size} - ${i.qty}</div>`).join("")}
              </div>
            </div>

            <div class="label-section"><strong>Carton Number:</strong> ${cartonNumber}/${grandTotal}</div>
            <div class="label-section"><strong>Style:</strong> ${style}</div>
          </div>
        `;

        exportWrapper.innerHTML = "";
        exportWrapper.appendChild(label);

        // let layout settle
        await new Promise((r) => setTimeout(r, 30));

        const canvas = await html2canvas(label, {
          scale: CANVAS_SCALE,
          useCORS: true,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");

        if (i !== 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
      }

      document.body.removeChild(exportWrapper);

      // save this batch
      const from = batchStart + 1;
      const to = batchEnd;
      pdf.save(`Carton_Labels_PO_${poClean}_${from}-${to}.pdf`);

      batchStart = batchEnd;
      batchIndex++;
    }

    setProgress(grandTotal, grandTotal, "Done:");
  } catch (err) {
    console.error(err);
    alert(
      "PDF export failed (likely too many labels in one batch). Try a smaller batch size.",
    );
  } finally {
    // small delay so “Done” shows briefly
    setTimeout(hideProgress, 500);
  }
}

function buildPackingListRowsFromLogs() {
  const styles = Object.keys(allStyleEntries || {}).sort();

  // Flatten all cartons (log entries) across all styles
  const flat = [];
  styles.forEach((style) => {
    const data = allStyleEntries[style];
    if (!data?.logEntries?.length) return;

    data.logEntries.forEach((entry) => {
      flat.push({ style, entry });
    });
  });

  // Build rows with continuous carton numbers
  const rows = flat.map(({ style, entry }, idx) => {
    const cartonNo = idx + 1;

    // Initialize size columns to 0
    const sizeMap = Object.fromEntries(sizes.map((s) => [s, 0]));

    // Fill from entry.items
    (entry.items || []).forEach(({ size, qty }) => {
      if (sizeMap[size] !== undefined) sizeMap[size] += Number(qty) || 0;
    });

    // "To" column = total units in carton
    const totalUnits = sizes.reduce((sum, s) => sum + (sizeMap[s] || 0), 0);

    return { cartonNo, style, ...sizeMap, totalUnits };
  });

  return rows;
}

function exportPackingListToExcel() {
  loadFromStorage();

  const bookingRef = prompt(
    "Enter BOOKING REF:",
    localStorage.getItem("lastBookingRef") || "",
  );
  if (bookingRef === null) return;

  const po = prompt("Enter PO Number:", localStorage.getItem("lastPO") || "");
  if (po === null) return;

  const bookingRefClean = bookingRef.trim();
  const poClean = po.trim();

  localStorage.setItem("lastBookingRef", bookingRefClean);
  localStorage.setItem("lastPO", poClean);

  // Flatten all cartons (log entries) across all styles
  const styles = Object.keys(allStyleEntries || {}).sort();
  const flat = [];

  const totalLabels = flat.length;

  if (totalLabels > 100) {
    const ok = confirm(
      `You are about to export ${totalLabels} labels.\n\n` +
        `Large exports can be slow or fail in the browser.\n\n` +
        `Tip: consider exporting in batches (e.g. 1–50, 51–100).\n\n` +
        `Continue anyway?`,
    );
    if (!ok) return;
  }

  styles.forEach((style) => {
    const data = allStyleEntries[style];
    if (!data?.logEntries?.length) return;
    data.logEntries.forEach((entry) => flat.push({ style, entry }));
  });

  if (flat.length === 0) {
    alert("No cartons found to export.");
    return;
  }

  const cartonRange = `1-${flat.length}`;

  // Totals accumulators
  const totalsBySize = Object.fromEntries(sizes.map((s) => [s, 0]));
  let grandTotalUnits = 0;

  // Build sheet content
  const aoa = [];
  aoa.push(["", "SISTERS AND SEEKERS PACKING LIST"]);
  aoa.push([]);
  aoa.push([`BOOKING REF: ${bookingRefClean}`]);
  aoa.push([]);
  aoa.push([
    `CARTON NUMBER RANGE: ${cartonRange}`,
    "",
    "",
    "",
    `PO Number: ${poClean}`,
  ]);
  aoa.push([]);
  aoa.push(["Carton No.", "Style", ...sizes, "Total"]);

  flat.forEach(({ style, entry }, idx) => {
    const cartonNo = idx + 1;

    const sizeMap = Object.fromEntries(sizes.map((s) => [s, 0]));
    (entry.items || []).forEach(({ size, qty }) => {
      if (sizeMap[size] !== undefined) sizeMap[size] += Number(qty) || 0;
    });

    const totalUnits = sizes.reduce((sum, s) => sum + sizeMap[s], 0);

    // accumulate grand totals
    sizes.forEach((s) => (totalsBySize[s] += sizeMap[s]));
    grandTotalUnits += totalUnits;

    aoa.push([cartonNo, style, ...sizes.map((s) => sizeMap[s]), totalUnits]);
  });

  // Add totals at the bottom
  aoa.push([]); // spacer row

  // TOTALS row (per-size + To)
  aoa.push([
    "", // Carton No. blank
    "Total Units By Size", // Style column label
    ...sizes.map((s) => totalsBySize[s]),
    grandTotalUnits,
  ]);

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths (supported even in unstyled)
  ws["!cols"] = [
    { wch: 12 }, // Carton No.
    { wch: 30 }, // Style
    ...sizes.map(() => ({ wch: 8 })),
    { wch: 8 }, // To
  ];

  // Merge title row (still supported)
  ws["!merges"] = [
    {
      s: { r: 0, c: 1 },
      e: { r: 0, c: 2 + sizes.length },
    },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Packing List");
  XLSX.writeFile(wb, `Packing_List_PO_${poClean || "NA"}.xlsx`);
}

function buildFlatCartonsAcrossAllStyles() {
  const styles = Object.keys(allStyleEntries || {}).sort();
  const flat = [];

  styles.forEach((style) => {
    const data = allStyleEntries[style];
    if (!data?.logEntries?.length) return;
    data.logEntries.forEach((entry) => flat.push({ style, entry }));
  });

  return flat;
}

function ensureProgressOverlay() {
  let overlay = document.getElementById("pdfProgressOverlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "pdfProgressOverlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 99999;
  `;

  overlay.innerHTML = `
    <div style="
      background: #fff;
      padding: 16px 20px;
      border-radius: 8px;
      min-width: 280px;
      text-align: center;
      font-family: Arial, sans-serif;
    ">
      <div style="font-weight: 700; margin-bottom: 8px;">Exporting PDF…</div>
      <div id="pdfProgressText" style="margin-bottom: 10px;">Preparing…</div>
      <div style="height: 8px; background:#eee; border-radius: 99px; overflow:hidden;">
        <div id="pdfProgressBar" style="height: 8px; width: 0%; background:#333;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

function setProgress(current, total, extra = "") {
  const overlay = ensureProgressOverlay();
  const text = overlay.querySelector("#pdfProgressText");
  const bar = overlay.querySelector("#pdfProgressBar");

  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  text.textContent = `${extra} ${current} / ${total}`;
  bar.style.width = `${pct}%`;
}

function showProgress() {
  const overlay = ensureProgressOverlay();
  overlay.style.display = "flex";
}

function hideProgress() {
  const overlay = ensureProgressOverlay();
  overlay.style.display = "none";
}
