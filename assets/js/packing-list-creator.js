function parseLabels() {
  const text = document.getElementById("labelInput").value;
  const blocks = text.split(/Supplier Address/).filter(b => b.trim());
  const tbody = document.querySelector("#packingTable tbody");
  tbody.innerHTML = ""; // Clear existing table

  blocks.forEach(block => {
    const poMatch = block.match(/PO Number:\s*(\d+)/i);
    const styleMatch = block.match(/Style:\s*(.+)/i);
    const cartonMatch = block.match(/Carton Number:\s*(\d+)\/\d+/i);

    if (styleMatch && cartonMatch) {
      const sizes = { "2XS": 0, "XS": 0, "S": 0, "M": 0, "L": 0 };

      // Match all lines like "xs - 10", "m - 5", etc.
      const sizeLines = block.match(/([a-z0-9]+)\s*-\s*(\d+)/gi);

      if (sizeLines) {
        sizeLines.forEach(line => {
          const match = line.match(/([a-z0-9]+)\s*-\s*(\d+)/i);
          if (match) {
            let sizeKey = match[1].toUpperCase();
            let quantity = parseInt(match[2]);

            // Normalize common variations
            if (sizeKey === "XXS" || sizeKey === "2XS") sizeKey = "2XS";
            if (sizes.hasOwnProperty(sizeKey)) {
              sizes[sizeKey] += quantity;
            }
          }
        });
      }

      const total = Object.values(sizes).reduce((a, b) => a + b, 0);

      const row = `<tr>
        <td>${cartonMatch[1]}</td>
        <td>${styleMatch[1]}</td>
        <td>${sizes["2XS"]}</td>
        <td>${sizes["XS"]}</td>
        <td>${sizes["S"]}</td>
        <td>${sizes["M"]}</td>
        <td>${sizes["L"]}</td>
        <td>${total}</td>
      </tr>`;

      tbody.innerHTML += row;
    }
  });

  updateTotals();
}


  function updateTotals() {
    const totals = { "2XS": 0, "XS": 0, "S": 0, "M": 0, "L": 0 };
    document.querySelectorAll("#packingTable tbody tr").forEach(row => {
      const cells = row.querySelectorAll("td");
      totals["2XS"] += parseInt(cells[2].textContent);
      totals["XS"]  += parseInt(cells[3].textContent);
      totals["S"]   += parseInt(cells[4].textContent);
      totals["M"]   += parseInt(cells[5].textContent);
      totals["L"]   += parseInt(cells[6].textContent);
    });

    const totalsRow = document.getElementById("totalsRow");
    totalsRow.cells[2].textContent = totals["2XS"];
    totalsRow.cells[3].textContent = totals["XS"];
    totalsRow.cells[4].textContent = totals["S"];
    totalsRow.cells[5].textContent = totals["M"];
    totalsRow.cells[6].textContent = totals["L"];
  }

  function downloadExcel() {
    const wb = XLSX.utils.book_new();
    const ws_data = [];

    // Header
    ws_data.push(["", "", "", "Size", "", "", "", ""]);
    ws_data.push(["Carton No.", "STYLE", "2XS", "XS", "S", "M", "L", "Total units in Carton"]);

    // Data rows
    document.querySelectorAll("#packingTable tbody tr").forEach(tr => {
      // Carton number and size counts as real numbers, style stays text
      const row = Array.from(tr.children).map((td, i) => i === 1 ? td.textContent : Number(td.textContent));
      ws_data.push(row);
    });

    // Totals row
    const totalRow = document.querySelector("#totalsRow");
    // The label cell spans two columns in the HTML, so pad it to keep totals under their size columns
    const totalData = ["Totals Units By Size", ""].concat(
      Array.from(totalRow.children).slice(1).map(td => td.textContent)
    );
    ws_data.push(totalData);

    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Explicit widths and row heights so every row has a fixed size when printed
    ws["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 22 }];
    ws["!rows"] = ws_data.map(() => ({ hpt: 18 }));
    ws["!margins"] = { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };
    XLSX.utils.book_append_sheet(wb, ws, "Packing List");
    XLSX.writeFile(wb, "Formatted_Packing_List.xlsx");
  }

  async function downloadPdf() {
    const sizeCols = ["2XS", "XS", "S", "M", "L"];
    const rows = Array.from(document.querySelectorAll("#packingTable tbody tr")).map(tr => {
      const cells = tr.querySelectorAll("td");
      const sizeMap = {};
      sizeCols.forEach((s, i) => (sizeMap[s] = Number(cells[i + 2].textContent) || 0));
      return {
        cartonNo: Number(cells[0].textContent),
        style: cells[1].textContent.trim(),
        sizeMap,
        total: Number(cells[7].textContent) || 0
      };
    });

    if (rows.length === 0) {
      alert("Parse some labels first.");
      return;
    }

    const bookingRef = prompt("Enter BOOKING REF:", localStorage.getItem("lastBookingRef") || "");
    if (bookingRef === null) return;
    const po = prompt("Enter PO Number:", localStorage.getItem("lastPO") || "");
    if (po === null) return;

    localStorage.setItem("lastBookingRef", bookingRef.trim());
    localStorage.setItem("lastPO", po.trim());

    await createPackingListPdf({ rows, sizes: sizeCols, bookingRef: bookingRef.trim(), po: po.trim() });
  }

function resetPackingList() {
document.querySelector("#packingTable tbody").innerHTML = "";
const tr = document.getElementById("totalsRow").children;
for (let i = 2; i <= 6; i++) {
  tr[i].textContent = "0";
}
}
