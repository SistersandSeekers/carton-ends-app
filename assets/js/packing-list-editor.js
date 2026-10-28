// Review & edit screen shown before the packing list PDF is made.
// Needs packing-list-pdf.js (createPackingListPdf) loaded first.
// opts: { rows, sizes, bookingRef, po }
//   rows: [{ cartonNo, style, sizeMap: { SIZE: qty }, total }]
function openPackingListEditor({ rows, sizes, bookingRef, po }) {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const original = clone(rows);
  let data = clone(rows);

  // Only show size columns that have units; the others can be added from the dropdown
  const usedSizes = (list) => {
    const u = sizes.filter((s) => list.some((r) => (r.sizeMap[s] || 0) > 0));
    return u.length ? u : sizes.slice(0, 1);
  };
  let visible = usedSizes(data);

  if (!document.getElementById("plEditorStyles")) {
    const st = document.createElement("style");
    st.id = "plEditorStyles";
    st.textContent = `
      .pl-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 2000;
        display: flex; align-items: center; justify-content: center; padding: 16px; }
      .pl-panel { background: #fff; border-radius: 12px; width: 100%; max-width: 960px;
        max-height: 92vh; display: flex; flex-direction: column; text-align: left; }
      .pl-head { padding: 20px 24px 12px; border-bottom: 1px solid #e6e1d8; }
      .pl-head h3 { margin: 0 0 12px; font-family: "Playfair Display", serif; font-size: 1.4rem; }
      .pl-fields { display: flex; gap: 16px; flex-wrap: wrap; }
      .pl-fields label { margin: 0; font-size: 12px; color: #6b665d; display: flex; flex-direction: column; gap: 4px; }
      .pl-fields input { width: 220px; margin: 0; }
      .pl-hint { font-size: 12px; color: #6b665d; margin: 10px 0 0; }
      .pl-body { padding: 8px 24px; overflow: auto; flex: 1; }
      .pl-body table { margin: 8px 0; width: 100%; }
      .pl-body td, .pl-body th { padding: 6px 8px; }
      .pl-body input { margin: 0; padding: 6px 8px; width: 100%; box-sizing: border-box; }
      .pl-body input.pl-num { width: 68px; }
      .pl-body td.pl-total { font-weight: 600; }
      .pl-body .pl-row-btn { padding: 4px 8px; margin: 0 2px 0 0; }
      .pl-toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 8px 0; }
      .pl-toolbar button { margin: 0; }
      .pl-toolbar select { padding: 8px; border-radius: 8px; border: 1px solid #e6e1d8; font: inherit; }
      .pl-foot { padding: 14px 24px; border-top: 1px solid #e6e1d8; display: flex; justify-content: flex-end; gap: 8px; }
      .pl-foot button { margin: 0; }
    `;
    document.head.appendChild(st);
  }

  const overlay = document.createElement("div");
  overlay.className = "pl-overlay no-print";
  overlay.innerHTML = `
    <div class="pl-panel" role="dialog" aria-modal="true" aria-label="Review packing list">
      <div class="pl-head">
        <h3>Review packing list</h3>
        <div class="pl-fields">
          <label>Booking ref <input type="text" id="plBooking"></label>
          <label>PO number <input type="text" id="plPo"></label>
        </div>
        <p class="pl-hint">Edit anything below. Changes only affect this PDF, not your saved counts or labels.</p>
      </div>
      <div class="pl-body">
        <div class="pl-toolbar">
          <button type="button" id="plAddRow">+ Add carton</button>
          <button type="button" id="plRenumber">Renumber 1 to n</button>
          <select id="plSizeSelect" aria-label="Size column to add"></select>
          <button type="button" id="plAddSize">Add size column</button>
          <button type="button" id="plReset">Reset changes</button>
        </div>
        <table id="plTable"><thead></thead><tbody></tbody><tfoot></tfoot></table>
      </div>
      <div class="pl-foot">
        <button type="button" id="plCancel">Cancel</button>
        <button type="button" id="plDownload" class="primary">Download PDF</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const $ = (sel) => overlay.querySelector(sel);
  $("#plBooking").value = bookingRef || "";
  $("#plPo").value = po || "";

  const thead = $("#plTable thead");
  const tbody = $("#plTable tbody");
  const tfoot = $("#plTable tfoot");

  const rowTotal = (r) => visible.reduce((sum, s) => sum + (r.sizeMap[s] || 0), 0);

  // Update the per-row totals and the totals row without rebuilding the inputs
  function updateTotals() {
    data.forEach((r, i) => {
      r.total = rowTotal(r);
      const cell = tbody.rows[i] && tbody.rows[i].querySelector(".pl-total");
      if (cell) cell.textContent = r.total;
    });
    const cells = tfoot.querySelectorAll("td"); // label, one per size, grand total, spacer
    let grand = 0;
    visible.forEach((s, i) => {
      const sum = data.reduce((a, r) => a + (r.sizeMap[s] || 0), 0);
      grand += sum;
      cells[1 + i].textContent = sum;
    });
    cells[1 + visible.length].textContent = grand;
  }

  function render() {
    thead.innerHTML =
      "<tr><th>Carton</th><th>Style</th>" +
      visible.map((s) => "<th>" + s + "</th>").join("") +
      "<th>Total</th><th></th></tr>";

    tbody.innerHTML = "";
    data.forEach((r, i) => {
      const tr = document.createElement("tr");

      const tdNo = document.createElement("td");
      const no = document.createElement("input");
      no.type = "number";
      no.min = "1";
      no.className = "pl-num";
      no.value = r.cartonNo;
      no.oninput = () => (r.cartonNo = parseInt(no.value, 10) || 0);
      tdNo.appendChild(no);
      tr.appendChild(tdNo);

      const tdStyle = document.createElement("td");
      const style = document.createElement("input");
      style.type = "text";
      style.value = r.style;
      style.oninput = () => (r.style = style.value);
      tdStyle.appendChild(style);
      tr.appendChild(tdStyle);

      visible.forEach((s) => {
        const td = document.createElement("td");
        const q = document.createElement("input");
        q.type = "number";
        q.min = "0";
        q.className = "pl-num";
        q.value = r.sizeMap[s] || 0;
        q.oninput = () => {
          r.sizeMap[s] = Math.max(0, parseInt(q.value, 10) || 0);
          updateTotals();
        };
        td.appendChild(q);
        tr.appendChild(td);
      });

      const tdTotal = document.createElement("td");
      tdTotal.className = "pl-total";
      tr.appendChild(tdTotal);

      const tdAct = document.createElement("td");
      tdAct.style.whiteSpace = "nowrap";
      const addBtn = (text, title, fn, disabled) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pl-row-btn";
        b.textContent = text;
        b.title = title;
        b.disabled = !!disabled;
        b.onclick = fn;
        tdAct.appendChild(b);
      };
      addBtn("↑", "Move up", () => {
        [data[i - 1], data[i]] = [data[i], data[i - 1]];
        render();
      }, i === 0);
      addBtn("↓", "Move down", () => {
        [data[i + 1], data[i]] = [data[i], data[i + 1]];
        render();
      }, i === data.length - 1);
      addBtn("✕", "Delete carton", () => {
        data.splice(i, 1);
        render();
      });
      tr.appendChild(tdAct);

      tbody.appendChild(tr);
    });

    tfoot.innerHTML =
      '<tr><td colspan="2">Total units by size</td>' +
      visible.map(() => "<td></td>").join("") +
      "<td></td><td></td></tr>";

    // dropdown of size columns that are currently hidden
    const hidden = sizes.filter((s) => !visible.includes(s));
    const sel = $("#plSizeSelect");
    sel.innerHTML = hidden.map((s) => '<option value="' + s + '">' + s + "</option>").join("");
    sel.disabled = hidden.length === 0;
    $("#plAddSize").disabled = hidden.length === 0;

    updateTotals();
  }

  $("#plAddRow").onclick = () => {
    const last = data[data.length - 1];
    data.push({
      cartonNo: data.reduce((m, r) => Math.max(m, r.cartonNo), 0) + 1,
      style: last ? last.style : "",
      sizeMap: Object.fromEntries(sizes.map((s) => [s, 0])),
      total: 0,
    });
    render();
    $(".pl-body").scrollTop = $(".pl-body").scrollHeight;
  };

  $("#plRenumber").onclick = () => {
    data.forEach((r, i) => (r.cartonNo = i + 1));
    render();
  };

  $("#plAddSize").onclick = () => {
    const s = $("#plSizeSelect").value;
    if (s && !visible.includes(s)) {
      visible = sizes.filter((x) => visible.includes(x) || x === s); // keep standard order
      render();
    }
  };

  $("#plReset").onclick = () => {
    data = clone(original);
    visible = usedSizes(data);
    render();
  };

  const close = () => overlay.remove();
  $("#plCancel").onclick = close;
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  $("#plDownload").onclick = async () => {
    if (data.length === 0) {
      alert("There are no cartons in the packing list.");
      return;
    }
    const booking = $("#plBooking").value.trim();
    const poVal = $("#plPo").value.trim();
    try {
      localStorage.setItem("lastBookingRef", booking);
      localStorage.setItem("lastPO", poVal);
    } catch (e) {}

    // Size columns you didn't show are zeroed, so they stay out of the PDF
    const out = data.map((r) => {
      const sizeMap = Object.fromEntries(
        sizes.map((s) => [s, visible.includes(s) ? r.sizeMap[s] || 0 : 0]),
      );
      return {
        cartonNo: r.cartonNo,
        style: r.style.trim(),
        sizeMap,
        total: sizes.reduce((a, s) => a + sizeMap[s], 0),
      };
    });

    const btn = $("#plDownload");
    btn.disabled = true;
    try {
      await createPackingListPdf({ rows: out, sizes, bookingRef: booking, po: poVal });
      close();
    } catch (err) {
      console.error(err);
      alert("Could not create the PDF. Check the browser console for details.");
      btn.disabled = false;
    }
  };

  render();
  $("#plBooking").focus();
}
