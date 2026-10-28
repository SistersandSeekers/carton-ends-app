document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("cartonForm");
  const container = document.getElementById("labels-container");
  const clearButton = document.getElementById("clearLabels");
  const exportButton = document.getElementById("exportPdf");

  // 🔁 Centralized function to render labels from localStorage
  function refreshLabels() {
    container.innerHTML = ""; // Clear existing labels
    const savedLabels = JSON.parse(localStorage.getItem("labels") || "[]");
    const template = document.getElementById("label-template").content;
    const total = savedLabels.length;

    savedLabels.forEach(labelData => {
      const fragment = document.importNode(template, true);
      const label = fragment.querySelector(".label");

      label.querySelector(".out-po").innerText = labelData.po;
      label.querySelector(".out-style").innerText = labelData.style;
      label.querySelector(".out-cartonNumber").innerText = `${labelData.cartonNumber}/${total}`;

      const contentsDiv = label.querySelector(".out-contents");
      contentsDiv.innerHTML = (labelData.sizes || []).map(
        s => `<div class="label-box">${s.size} - ${s.quantity}</div>`
      ).join("");

      container.appendChild(label);
    });
  }

  // 🚀 Render labels on page load
  refreshLabels();

  form?.addEventListener("submit", (e) => {
    e.preventDefault();

    const po = document.getElementById("po").value.trim();
    const style = document.getElementById("style").value.trim();
    const excelText = document.getElementById("excelData").value.trim();

    if (!excelText) {
      alert("Please paste your Excel data!");
      return;
    }

    localStorage.setItem("lastPO", po);

    const lines = excelText.split(/\r?\n/);
    if (lines.length < 2) {
      alert("Please include headers and at least one row of data!");
      return;
    }

    const rawHeaders = lines[0].split(/\t/).map(h => h.trim());
    const headers = rawHeaders.map(h => h.toUpperCase());

    const sizeIndex = headers.findIndex(h => h === "SIZE");
    const qtyIndex = headers.findIndex(h => h === "QUANTITY");

    if (sizeIndex === -1 || qtyIndex === -1) {
      alert(`Header must contain 'Size' and 'Quantity'. Found: ${rawHeaders.join(", ")}`);
      return;
    }

    const entries = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].trim();
      if (!row) continue;

      const cells = row.split(/\t/);
      if (cells.length <= Math.max(sizeIndex, qtyIndex)) {
        console.warn(`Skipping malformed row: ${row}`);
        continue;
      }

      const sizeCell = cells[sizeIndex]?.trim();
      const qtyCell = cells[qtyIndex]?.trim();

      if (!sizeCell || !qtyCell) continue;

      const sizeParts = sizeCell.split(",").map(s => s.trim().toLowerCase());
      const qtyParts = qtyCell.split(",").map(q => q.trim());

      if (sizeParts.length !== qtyParts.length) {
        console.warn(`Mismatched size/qty in row: ${row}`);
        continue;
      }

      const contents = [];
      for (let j = 0; j < sizeParts.length; j++) {
        const quantity = Number(qtyParts[j]);
        if (!isNaN(quantity) && quantity > 0) {
          contents.push({ size: sizeParts[j], quantity });
        }
      }

      if (contents.length > 0) {
        entries.push(contents); // Push the whole group as one label
      }
    }

    if (entries.length === 0) {
      alert("No valid size/quantity data found.");
      return;
    }

    const template = document.getElementById("label-template").content;
    const existingLabels = container.querySelectorAll(".label");
    const savedLabels = JSON.parse(localStorage.getItem("labels") || "[]");
    const newTotal = existingLabels.length + entries.length;

    // 🆕 Create new label data (we will re-render from this)
    const newLabelData = [];

    entries.forEach((entryGroup, index) => {
      const cartonNumber = existingLabels.length + index + 1;
      newLabelData.push({
        po,
        style,
        cartonNumber,
        sizes: entryGroup
      });
    });

    // 💾 Save all labels to localStorage
    const allLabels = [...savedLabels, ...newLabelData];
    localStorage.setItem("labels", JSON.stringify(allLabels));

    // 🔄 Re-render labels
    refreshLabels();
  });

  // 🧹 Clear labels and storage
  clearButton?.addEventListener("click", () => {
    container.innerHTML = "";
    localStorage.removeItem("labels");
    localStorage.removeItem("lastCartonStart");
    refreshLabels(); // <- ensure the UI resets too
  });

  // 📄 Export as PDF (in batches so large orders don't crash the browser)
  exportButton?.addEventListener("click", async () => {
    const labels = Array.from(document.querySelectorAll(".label"));
    const total = labels.length;
    if (total === 0) {
      alert("No labels to export.");
      return;
    }

    const defaultBatch = Math.min(total, 40);
    const batchStr = prompt(
      `You have ${total} labels.

` +
        `Enter batch size (e.g. 40). Larger batches may fail in-browser.`,
      String(defaultBatch),
    );
    if (batchStr === null) return;

    let batchSize = parseInt(batchStr, 10);
    if (!Number.isFinite(batchSize) || batchSize <= 0) batchSize = defaultBatch;

    const { jsPDF } = window.jspdf;
    const originalText = exportButton.innerText;
    exportButton.disabled = true;

    try {
      for (let batchStart = 0; batchStart < total; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, total);
        const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

        for (let i = batchStart; i < batchEnd; i++) {
          exportButton.innerText = `Exporting ${i + 1}/${total}…`;

          const canvas = await html2canvas(labels[i], {
            scale: 1.5,
            useCORS: true,
            backgroundColor: "#ffffff",
          });
          // JPEG uses far less memory than PNG, which matters on big orders
          const imgData = canvas.toDataURL("image/jpeg", 0.85);

          if (i !== batchStart) pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");

          // release the canvas memory straight away
          canvas.width = 0;
          canvas.height = 0;
        }

        pdf.save(
          total <= batchSize
            ? "Carton_Labels.pdf"
            : `Carton_Labels_${batchStart + 1}-${batchEnd}.pdf`,
        );

        // pause so the browser doesn't block back-to-back downloads
        if (batchEnd < total) await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err) {
      console.error(err);
      alert(
        "PDF export failed (likely too many labels in one batch). Try a smaller batch size.",
      );
    } finally {
      exportButton.innerText = originalText;
      exportButton.disabled = false;
    }
  });
});
