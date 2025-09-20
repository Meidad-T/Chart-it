let previewMode = false;
const chart = document.getElementById("chart");
const columnsRow = document.getElementById("columns");
const rowsBody = document.getElementById("rows");

function addColumn(name) {
  if (!name) name = document.getElementById("columnName").value.trim();
  if (!name) return;
  const th = document.createElement("th");
  th.textContent = name;
  columnsRow.appendChild(th);

  // add a cell to each existing row
  Array.from(rowsBody.querySelectorAll("tr")).forEach(tr => {
    const td = document.createElement("td");
    td.onclick = () => cellClicked(td);
    tr.appendChild(td);
  });
  document.getElementById("columnName").value = "";
}

function addRow(name) {
  if (!name) name = document.getElementById("rowName").value.trim();
  if (!name) return;
  const tr = document.createElement("tr");

  const th = document.createElement("th");
  th.textContent = name;
  tr.appendChild(th);

  // add cells for existing columns
  const colCount = columnsRow.children.length - 1;
  for (let i = 0; i < colCount; i++) {
    const td = document.createElement("td");
    td.onclick = () => cellClicked(td);
    tr.appendChild(td);
  }
  rowsBody.appendChild(tr);
  document.getElementById("rowName").value = "";
}

function togglePreview() {
  previewMode = !previewMode;
  chart.classList.toggle("preview-mode", previewMode);
}

function randomColor() {
  const r = Math.floor(Math.random() * 200 + 55);
  const g = Math.floor(Math.random() * 200 + 55);
  const b = Math.floor(Math.random() * 200 + 55);
  return `rgb(${r},${g},${b})`;
}

function createButterfly(color) {
  const butterfly = document.createElement("div");
  butterfly.className = "butterfly";
  butterfly.style.background = color || randomColor();
  return butterfly;
}

function cellClicked(td) {
  if (!previewMode) return;

  const butterfly = createButterfly();
  document.body.appendChild(butterfly);

  // starting position (top-left corner)
  butterfly.style.left = "20px";
  butterfly.style.top = "20px";
  butterfly.style.transform = "translate(0,0)";

  // force reflow
  butterfly.getBoundingClientRect();

  const rect = td.getBoundingClientRect();
  const targetX = rect.left + rect.width / 2;
  const targetY = rect.top + rect.height / 2;

  butterfly.style.left = `${targetX}px`;
  butterfly.style.top = `${targetY}px`;
  butterfly.style.transform = "translate(-50%, -50%)";

  // after transition, attach butterfly into the cell
  setTimeout(() => {
    butterfly.style.transition = "none";
    td.appendChild(butterfly);
    butterfly.style.position = "absolute";
    butterfly.style.left = "50%";
    butterfly.style.top = "50%";
    butterfly.style.transform = "translate(-50%, -50%)";
  }, 1000);
}

// --- Export / Import ---
function exportChart() {
  const data = {
    columns: [],
    rows: [],
    cells: []
  };

  // collect columns
  for (let i = 1; i < columnsRow.children.length; i++) {
    data.columns.push(columnsRow.children[i].textContent);
  }

  // collect rows + butterflies
  Array.from(rowsBody.children).forEach(tr => {
    const rowName = tr.children[0].textContent;
    data.rows.push(rowName);
    const rowCells = [];
    for (let i = 1; i < tr.children.length; i++) {
      const td = tr.children[i];
      const butterfly = td.querySelector(".butterfly");
      const hasButterfly = butterfly !== null;
      const color = hasButterfly ? butterfly.style.background : null;
      rowCells.push({ hasButterfly, color });
    }
    data.cells.push(rowCells);
  });

  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "chart.chart";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importChart(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const data = JSON.parse(e.target.result);

    // clear old chart
    columnsRow.innerHTML = "<th></th>";
    rowsBody.innerHTML = "";

    // rebuild columns
    data.columns.forEach(col => addColumn(col));

    // rebuild rows
    data.rows.forEach((row, rowIndex) => {
      addRow(row);
    });

    // restore butterflies
    data.cells.forEach((rowCells, rIndex) => {
      const tr = rowsBody.children[rIndex];
      rowCells.forEach((cell, cIndex) => {
        if (cell.hasButterfly) {
          const td = tr.children[cIndex + 1];
          const butterfly = createButterfly(cell.color);
          td.appendChild(butterfly);
          butterfly.style.position = "absolute";
          butterfly.style.left = "50%";
          butterfly.style.top = "50%";
          butterfly.style.transform = "translate(-50%, -50%)";
          butterfly.style.transition = "none";
        }
      });
    });
  };
  reader.readAsText(file);
}