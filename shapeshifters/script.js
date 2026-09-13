/**
 * Shapeshifters / Moving Staircases - Batch File Generator
 */

(function () {
  // DOM Elements
  const sizeSlider = document.getElementById('size-slider');
  const sizeInput = document.getElementById('size-input');
  const sizeDisplay = document.getElementById('size-display');
  const statShorts = document.getElementById('stat-shorts');
  const statLongs = document.getElementById('stat-longs');
  const statLetters = document.getElementById('stat-letters');
  const optComments = document.getElementById('opt-comments');
  const batchOutput = document.getElementById('batch-output');
  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');
  const gridContainer = document.getElementById('grid-container');
  const hoverCellInfo = document.getElementById('hover-cell-info');
  const viewButtons = document.querySelectorAll('.toggle-btn');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  let currentView = 'base'; // 'base' | 'shorts' | 'longs'

  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });

  // View toggling for grid
  viewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      viewButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.getAttribute('data-view');
      renderGrid();
    });
  });

  // Generate slot definitions
  function generateSlots(n) {
    const shorts = [];
    const longs = [];

    // Cell mapping to check memberships
    const cellMap = {};

    // 1. Shorts: Horizontal push (UR slides left by 1)
    // Produces (n + 1) words of length n
    for (let r = 0; r <= n; r++) {
      const slot = [];
      if (r > 0) {
        for (let c = 0; c < r; c++) {
          const id = `r${r}c${c}`;
          slot.push(id);
          if (!cellMap[id]) cellMap[id] = { id, row: r, col: c, part: 'LL' };
          cellMap[id].shortIdx = r + 1;
        }
      }
      if (r < n) {
        for (let c = r + 1; c <= n; c++) {
          const id = `r${r}c${c}`;
          slot.push(id);
          if (!cellMap[id]) cellMap[id] = { id, row: r, col: c, part: 'UR' };
          cellMap[id].shortIdx = r + 1;
        }
      }
      shorts.push(slot);
    }

    // 2. Longs: Vertical push (LL slides up by 1)
    // Produces n words of length (n + 1)
    for (let r = 0; r < n; r++) {
      const slot = [];
      // LL row r+1 (cols 0..r)
      for (let c = 0; c <= r; c++) {
        const id = `r${r + 1}c${c}`;
        slot.push(id);
        cellMap[id].longIdx = r + 1;
      }
      // UR row r (cols r+1..n)
      for (let c = r + 1; c <= n; c++) {
        const id = `r${r}c${c}`;
        slot.push(id);
        cellMap[id].longIdx = r + 1;
      }
      longs.push(slot);
    }

    return { shorts, longs, cellMap };
  }

  // Format batch output
  function formatBatchText(n, shorts, longs) {
    const includeComments = optComments.checked;
    const lines = [];

    if (includeComments) {
      lines.push(`# Shapeshifter / Moving Staircases Batch File (N = ${n})`);
      lines.push(`# Shorts: ${shorts.length} words of length ${n}`);
      lines.push(`# Longs: ${longs.length} words of length ${n + 1}`);
      lines.push(`# Total letters: ${n * (n + 1)}`);
      lines.push('');
      lines.push(`# --- Shorts (length ${n}) ---`);
    }

    shorts.forEach((slot, i) => {
      const comment = includeComments ? ` # Short ${i + 1}` : '';
      lines.push(`${slot.join(' ')}${comment}`);
    });

    if (includeComments) {
      lines.push('');
      lines.push(`# --- Longs (length ${n + 1}) ---`);
    }

    longs.forEach((slot, j) => {
      const comment = includeComments ? ` # Long ${j + 1}` : '';
      lines.push(`${slot.join(' ')}${comment}`);
    });

    lines.push('');
    return lines.join('\n');
  }

  // Render Visual Grid
  function renderGrid() {
    const n = parseInt(sizeInput.value, 10);
    const { shorts, longs, cellMap } = generateSlots(n);

    gridContainer.innerHTML = '';
    const gridEl = document.createElement('div');
    gridEl.className = 'puzzle-grid';

    if (currentView === 'base') {
      // (n + 1) rows x (n + 1) cols
      const cols = n + 1;
      const rows = n + 1;
      gridEl.style.gridTemplateColumns = `repeat(${cols}, 28px)`;
      gridEl.style.gridTemplateRows = `repeat(${rows}, 28px)`;

      for (let r = 0; r <= n; r++) {
        for (let c = 0; c <= n; c++) {
          const cell = document.createElement('div');
          cell.className = 'puzzle-cell';

          if ((r === 0 && c === 0) || (r === n && c === n)) {
            cell.classList.add('cell-void');
          } else if (r === c && r > 0 && r < n) {
            cell.classList.add('cell-blk');
            cell.title = `Block (r${r}c${c})`;
          } else if (c > r) {
            // Upper-Right
            const id = `r${r}c${c}`;
            cell.classList.add('cell-ur');
            setupCellInteractions(cell, id, cellMap[id]);
          } else {
            // Lower-Left
            const id = `r${r}c${c}`;
            cell.classList.add('cell-ll');
            setupCellInteractions(cell, id, cellMap[id]);
          }

          gridEl.appendChild(cell);
        }
      }
    } else if (currentView === 'shorts') {
      // (n + 1) rows x n cols
      gridEl.style.gridTemplateColumns = `repeat(${n}, 28px)`;
      gridEl.style.gridTemplateRows = `repeat(${n + 1}, 28px)`;

      shorts.forEach((slot, slotIdx) => {
        slot.forEach(cellId => {
          const info = cellMap[cellId];
          const cell = document.createElement('div');
          cell.className = 'puzzle-cell';
          cell.classList.add(info.part === 'UR' ? 'cell-ur' : 'cell-ll');
          setupCellInteractions(cell, cellId, info);
          gridEl.appendChild(cell);
        });
      });
    } else if (currentView === 'longs') {
      // n rows x (n + 1) cols
      gridEl.style.gridTemplateColumns = `repeat(${n + 1}, 28px)`;
      gridEl.style.gridTemplateRows = `repeat(${n}, 28px)`;

      longs.forEach((slot, slotIdx) => {
        slot.forEach(cellId => {
          const info = cellMap[cellId];
          const cell = document.createElement('div');
          cell.className = 'puzzle-cell';
          cell.classList.add(info.part === 'UR' ? 'cell-ur' : 'cell-ll');
          setupCellInteractions(cell, cellId, info);
          gridEl.appendChild(cell);
        });
      });
    }

    gridContainer.appendChild(gridEl);
  }

  function setupCellInteractions(cellEl, cellId, info) {
    cellEl.textContent = '';
    cellEl.dataset.cellId = cellId;

    cellEl.addEventListener('mouseenter', () => {
      if (info) {
        hoverCellInfo.textContent = `Cell ${cellId} [${info.part}]: Short #${info.shortIdx} (Row ${info.shortIdx}), Long #${info.longIdx} (Row ${info.longIdx})`;
      }
    });

    cellEl.addEventListener('mouseleave', () => {
      hoverCellInfo.innerHTML = '&nbsp;';
    });
  }

  // Update everything
  function updateAll() {
    const n = parseInt(sizeInput.value, 10);
    if (isNaN(n) || n < 2) return;

    sizeDisplay.textContent = n;
    const numShorts = n + 1;
    const lenShorts = n;
    const numLongs = n;
    const lenLongs = n + 1;
    const totalLetters = n * (n + 1);

    statShorts.textContent = `${numShorts} words × ${lenShorts} letters`;
    statLongs.textContent = `${numLongs} words × ${lenLongs} letters`;
    statLetters.textContent = `${totalLetters} letters`;

    const { shorts, longs } = generateSlots(n);
    batchOutput.value = formatBatchText(n, shorts, longs);

    renderGrid();
  }

  // Sync inputs
  sizeSlider.addEventListener('input', () => {
    sizeInput.value = sizeSlider.value;
    updateAll();
  });

  sizeInput.addEventListener('input', () => {
    let val = parseInt(sizeInput.value, 10);
    if (val < 2) val = 2;
    if (val > 15) val = 15;
    sizeSlider.value = val;
    updateAll();
  });

  optComments.addEventListener('change', updateAll);

  // Copy to clipboard
  copyBtn.addEventListener('click', () => {
    const text = batchOutput.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showCopiedState);
    } else {
      batchOutput.select();
      document.execCommand('copy');
      showCopiedState();
    }
  });

  function showCopiedState() {
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      Copied!
    `;
    copyBtn.style.backgroundColor = '#16a34a';
    setTimeout(() => {
      copyBtn.innerHTML = originalText;
      copyBtn.style.backgroundColor = '';
    }, 1800);
  }

  // Download file
  downloadBtn.addEventListener('click', () => {
    const n = sizeInput.value;
    const text = batchOutput.value;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shapeshifter_N${n}_batch.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Initial update
  updateAll();
})();
