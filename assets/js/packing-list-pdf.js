// Shared branded packing list PDF (portrait A4). Needs jsPDF loaded on the page.
// rows: [{ cartonNo, style, sizeMap: { SIZE: qty }, total }]

// Load the company logo as a PNG data URL for jsPDF (null if it can't load)
function loadLogoForPdf() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        resolve({
          data: canvas.toDataURL("image/png"),
          w: img.naturalWidth,
          h: img.naturalHeight,
        });
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = "assets/img/logo.webp";
  });
}

async function createPackingListPdf({ rows, sizes, bookingRef, po }) {
  const bookingRefClean = bookingRef;
  const poClean = po;

  // Only show size columns that are actually used
  const totalsBySize = Object.fromEntries(sizes.map((s) => [s, 0]));
  let grandTotalUnits = 0;
  rows.forEach((r) => {
    sizes.forEach((s) => (totalsBySize[s] += r.sizeMap[s] || 0));
    grandTotalUnits += r.total;
  });
  const cols = sizes.filter((s) => totalsBySize[s] > 0);

  const logo = await loadLogoForPdf();

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // Layout (A4 portrait: 210 x 297 mm)
  const M = 15;
  const pageW = 210;
  const pageH = 297;
  const tableW = pageW - M * 2;
  const wCarton = 18;
  const wSize = 12;
  const wTotal = 18;
  const wStyle = tableW - wCarton - wTotal - wSize * cols.length;
  const rowH = 7;
  const DARK = [34, 34, 34];
  const LIGHT = [238, 238, 238];
  const LINE = [190, 190, 190];

  const xs = [M, M + wCarton, M + wCarton + wStyle];
  cols.forEach((_, i) => xs.push(M + wCarton + wStyle + wSize * (i + 1)));
  // xs: carton, style, size columns..., total starts at xs[last]
  const xTotal = M + tableW - wTotal;

  function drawHeaderBlock() {
    // Logo (or text fallback)
    if (logo) {
      const lw = 55;
      pdf.addImage(logo.data, "PNG", M, 14, lw, (lw * logo.h) / logo.w);
    } else {
      pdf.setFont("helvetica", "bolditalic");
      pdf.setFontSize(18);
      pdf.setTextColor(...DARK);
      pdf.text("SistersandSeekers", M, 21);
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(...DARK);
    pdf.text("PACKING LIST", pageW - M, 20, { align: "right" });

    pdf.setDrawColor(...DARK);
    pdf.setLineWidth(0.6);
    pdf.line(M, 27, pageW - M, 27);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("Booking Ref:", M, 35);
    pdf.text("PO Number:", M, 41);
    pdf.text("Carton Range:", M + 95, 35);
    pdf.text("Total Units:", M + 95, 41);
    pdf.setFont("helvetica", "normal");
    pdf.text(bookingRefClean || "-", M + 25, 35);
    pdf.text(poClean || "-", M + 25, 41);
    pdf.text(`${Math.min(...rows.map((r) => r.cartonNo))}-${Math.max(...rows.map((r) => r.cartonNo))}`, M + 95 + 27, 35);
    pdf.text(String(grandTotalUnits), M + 95 + 27, 41);
  }

  function drawTableHeader(y) {
    pdf.setFillColor(...DARK);
    pdf.rect(M, y, tableW, rowH, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("Carton No.", M + wCarton / 2, y + 4.8, { align: "center" });
    pdf.text("Style", M + wCarton + 2, y + 4.8);
    cols.forEach((s, i) => {
      pdf.text(s, xs[2] + wSize * i + wSize / 2, y + 4.8, { align: "center" });
    });
    pdf.text("Total", xTotal + wTotal / 2, y + 4.8, { align: "center" });
    pdf.setTextColor(...DARK);
    return y + rowH;
  }

  function drawFooter(page, pages) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text("Sisters and Seekers Ltd", M, pageH - 10);
    pdf.text(`Page ${page} of ${pages}`, pageW - M, pageH - 10, {
      align: "right",
    });
  }

  drawHeaderBlock();
  let y = drawTableHeader(48);
  const bottomLimit = pageH - 22 - rowH; // leave room for totals row and footer

  pdf.setFontSize(9);
  rows.forEach((r, idx) => {
    const styleLines = pdf.splitTextToSize(r.style, wStyle - 4);
    const h = Math.max(rowH, styleLines.length * 4 + 3);

    if (y + h > bottomLimit) {
      pdf.addPage();
      y = drawTableHeader(M);
    }

    if (idx % 2 === 1) {
      pdf.setFillColor(...LIGHT);
      pdf.rect(M, y, tableW, h, "F");
    }
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.2);
    pdf.line(M, y + h, M + tableW, y + h);

    pdf.setFont("helvetica", "normal");
    const ty = y + 4.8;
    pdf.text(String(r.cartonNo), M + wCarton / 2, ty, { align: "center" });
    pdf.text(styleLines, M + wCarton + 2, ty);
    cols.forEach((s, i) => {
      pdf.text(String(r.sizeMap[s]), xs[2] + wSize * i + wSize / 2, ty, {
        align: "center",
      });
    });
    pdf.setFont("helvetica", "bold");
    pdf.text(String(r.total), xTotal + wTotal / 2, ty, { align: "center" });
    y += h;
  });

  // Totals row
  if (y + rowH > pageH - 18) {
    pdf.addPage();
    y = M;
  }
  pdf.setFillColor(...DARK);
  pdf.rect(M, y, tableW, rowH, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.text("Total Units By Size", M + 2, y + 4.8);
  cols.forEach((s, i) => {
    pdf.text(String(totalsBySize[s]), xs[2] + wSize * i + wSize / 2, y + 4.8, {
      align: "center",
    });
  });
  pdf.text(String(grandTotalUnits), xTotal + wTotal / 2, y + 4.8, {
    align: "center",
  });

  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    drawFooter(p, pages);
  }

  pdf.save(`Packing_List_PO_${poClean || "NA"}.pdf`);
}
