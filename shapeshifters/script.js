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

  // IPUZ DOM Elements
  const ipuzTitle = document.getElementById('ipuz-title');
  const ipuzAuthor = document.getElementById('ipuz-author');
  const ipuzCopyright = document.getElementById('ipuz-copyright');
  const ipuzSizeDisplay = document.getElementById('ipuz-size-display');
  const ipuzSizeSummary = document.getElementById('ipuz-size-summary');
  const cluesCountShorts = document.getElementById('clues-count-shorts');
  const cluesLenShorts = document.getElementById('clues-len-shorts');
  const cluesCountLongs = document.getElementById('clues-count-longs');
  const cluesLenLongs = document.getElementById('clues-len-longs');
  const ipuzSolutionInput = document.getElementById('ipuz-solution-input');
  const solutionStatus = document.getElementById('solution-status');
  const ipuzCluesInput = document.getElementById('ipuz-clues-input');
  const cluesStatus = document.getElementById('clues-status');
  const ipuzJsonOutput = document.getElementById('ipuz-json-output');
  const ipuzDownloadBtn = document.getElementById('ipuz-download-btn');
  const ipuzCopyBtn = document.getElementById('ipuz-copy-btn');

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

  // Generate slot definitions (SW to NE diagonal: r + c = n)
  function generateSlots(n) {
    const shorts = [];
    const longs = [];

    // Cell mapping to check memberships
    const cellMap = {};

    // 1. Shorts: Horizontal push (LR slides left by 1)
    // Produces (n + 1) words of length n
    for (let r = 0; r <= n; r++) {
      const slot = [];
      // Upper-Left part (cols 0 .. n-1-r)
      if (r < n) {
        for (let c = 0; c <= n - 1 - r; c++) {
          const id = `r${r}c${c}`;
          slot.push(id);
          if (!cellMap[id]) cellMap[id] = { id, row: r, col: c, part: 'UL' };
          cellMap[id].shortIdx = r + 1;
        }
      }
      // Lower-Right part (cols n-r+1 .. n)
      if (r > 0) {
        for (let c = n - r + 1; c <= n; c++) {
          const id = `r${r}c${c}`;
          slot.push(id);
          if (!cellMap[id]) cellMap[id] = { id, row: r, col: c, part: 'LR' };
          cellMap[id].shortIdx = r + 1;
        }
      }
      shorts.push(slot);
    }

    // 2. Longs: Vertical push (LR slides up by 1)
    // Produces n words of length (n + 1)
    for (let r = 0; r < n; r++) {
      const slot = [];
      // UL row r: cols 0 .. n-1-r
      for (let c = 0; c <= n - 1 - r; c++) {
        const id = `r${r}c${c}`;
        slot.push(id);
        cellMap[id].longIdx = r + 1;
      }
      // LR row r+1: cols n-r .. n
      for (let c = n - r; c <= n; c++) {
        const id = `r${r + 1}c${c}`;
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

          if ((r === 0 && c === n) || (r === n && c === 0)) {
            cell.classList.add('cell-void');
          } else if (r + c === n && r > 0 && r < n) {
            cell.classList.add('cell-blk');
            cell.title = `Block (r${r}c${c})`;
          } else if (r + c < n) {
            // Upper-Left
            const id = `r${r}c${c}`;
            cell.classList.add('cell-ul');
            setupCellInteractions(cell, id, cellMap[id]);
          } else {
            // Lower-Right
            const id = `r${r}c${c}`;
            cell.classList.add('cell-lr');
            setupCellInteractions(cell, id, cellMap[id]);
          }

          gridEl.appendChild(cell);
        }
      }
    } else if (currentView === 'shorts') {
      // (n + 1) rows x n cols
      gridEl.style.gridTemplateColumns = `repeat(${n}, 28px)`;
      gridEl.style.gridTemplateRows = `repeat(${n + 1}, 28px)`;

      shorts.forEach((slot) => {
        slot.forEach(cellId => {
          const info = cellMap[cellId];
          const cell = document.createElement('div');
          cell.className = 'puzzle-cell';
          cell.classList.add(info.part === 'UL' ? 'cell-ul' : 'cell-lr');
          setupCellInteractions(cell, cellId, info);
          gridEl.appendChild(cell);
        });
      });
    } else if (currentView === 'longs') {
      // n rows x (n + 1) cols
      gridEl.style.gridTemplateColumns = `repeat(${n + 1}, 28px)`;
      gridEl.style.gridTemplateRows = `repeat(${n}, 28px)`;

      longs.forEach((slot) => {
        slot.forEach(cellId => {
          const info = cellMap[cellId];
          const cell = document.createElement('div');
          cell.className = 'puzzle-cell';
          cell.classList.add(info.part === 'UL' ? 'cell-ul' : 'cell-lr');
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

    // Update IPUZ tab summary
    if (ipuzSizeDisplay) ipuzSizeDisplay.textContent = n;
    if (ipuzSizeSummary) ipuzSizeSummary.textContent = `${numShorts} Shorts × ${numLongs} Longs`;
    if (cluesCountShorts) cluesCountShorts.textContent = numShorts;
    if (cluesLenShorts) cluesLenShorts.textContent = lenShorts;
    if (cluesCountLongs) cluesCountLongs.textContent = numLongs;
    if (cluesLenLongs) cluesLenLongs.textContent = lenLongs;

    generateIpuz();
  }

  // --- IPUZ CREATOR LOGIC ---

  // Parse words from Ingrid output
  function parseSolutionWords(text, n) {
    if (!text || !text.trim()) return { shorts: [], longs: [], allWords: [] };
    const lines = text.split('\n');
    const words = [];
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      // Extract word from formats like "Slot 1: WORD" or just "WORD"
      const match = line.match(/(?:slot\s*\d+\s*:\s*)?([A-Za-z]+)/i);
      if (match && match[1] && match[1].length >= 2) {
        words.push(match[1].toUpperCase());
      }
    }
    const shortsCount = n + 1;
    const longsCount = n;
    const shorts = words.slice(0, shortsCount);
    const longs = words.slice(shortsCount, shortsCount + longsCount);
    return { shorts, longs, allWords: words };
  }

  // Parse clues from single textarea
  function parseClues(text, n) {
    if (!text || !text.trim()) return { shortsClues: [], longsClues: [] };
    const rawLines = text.split('\n');

    let inShorts = false;
    let inLongs = false;
    let hasHeaders = false;
    const sectionShorts = [];
    const sectionLongs = [];

    for (const rawLine of rawLines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (/^#?\s*shorts/i.test(line)) {
        inShorts = true;
        inLongs = false;
        hasHeaders = true;
        continue;
      }
      if (/^#?\s*longs/i.test(line)) {
        inLongs = true;
        inShorts = false;
        hasHeaders = true;
        continue;
      }
      // Strip leading numbering like "1. ", "1: ", "1 - ", "1) "
      const cleaned = line.replace(/^\d+[\.\-\:\)\s]+\s*/, '').trim();
      if (inShorts) {
        sectionShorts.push(cleaned);
      } else if (inLongs) {
        sectionLongs.push(cleaned);
      }
    }

    if (hasHeaders) {
      return { shortsClues: sectionShorts, longsClues: sectionLongs };
    }

    // Default: split sequentially (first n+1 for shorts, next n for longs)
    const cleanLines = rawLines
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .map(l => l.replace(/^\d+[\.\-\:\)\s]+\s*/, '').trim());

    const shortsClues = cleanLines.slice(0, n + 1);
    const longsClues = cleanLines.slice(n + 1, n + 1 + n);
    return { shortsClues, longsClues };
  }

  // Update validation and status displays for IPUZ tab
  function updateStatuses(n, solData, cluesData) {
    const totalWordsExpected = 2 * n + 1;
    if (solutionStatus) {
      if (solData.allWords.length === 0) {
        solutionStatus.className = 'status-indicator';
        solutionStatus.textContent = 'Waiting for solution input...';
      } else if (solData.allWords.length >= totalWordsExpected) {
        // Check crossing consistency
        let mismatches = 0;
        for (let r = 0; r < n; r++) {
          const longWord = solData.longs[r];
          const shortULWord = solData.shorts[r];
          const shortLRWord = solData.shorts[r + 1];
          if (longWord && shortULWord && shortLRWord) {
            // UL overlap
            const ulLong = longWord.slice(0, n - r);
            const ulShort = shortULWord.slice(0, n - r);
            if (ulLong !== ulShort) mismatches++;
            // LR overlap
            const lrLong = longWord.slice(n - r);
            const lrShort = shortLRWord.slice(shortLRWord.length - (r + 1));
            if (lrLong !== lrShort) mismatches++;
          }
        }
        if (mismatches === 0) {
          solutionStatus.className = 'status-indicator status-ok';
          solutionStatus.textContent = `✓ All ${totalWordsExpected} words loaded and all intersecting letters match!`;
        } else {
          solutionStatus.className = 'status-indicator status-warn';
          solutionStatus.textContent = `⚠️ Loaded ${totalWordsExpected} words, but found ${mismatches} mismatching crossing(s).`;
        }
      } else {
        solutionStatus.className = 'status-indicator status-warn';
        solutionStatus.textContent = `Loaded ${solData.allWords.length} of ${totalWordsExpected} expected words (${n + 1} Shorts, ${n} Longs).`;
      }
    }

    if (cluesStatus) {
      const totalClues = cluesData.shortsClues.length + cluesData.longsClues.length;
      if (totalClues === 0) {
        cluesStatus.className = 'status-indicator';
        cluesStatus.textContent = 'Waiting for clues...';
      } else if (cluesData.shortsClues.length === n + 1 && cluesData.longsClues.length === n) {
        cluesStatus.className = 'status-indicator status-ok';
        cluesStatus.textContent = `✓ All ${totalWordsExpected} clues loaded (${n + 1} Shorts, ${n} Longs)!`;
      } else {
        cluesStatus.className = 'status-indicator status-warn';
        cluesStatus.textContent = `Found ${cluesData.shortsClues.length} / ${n + 1} Shorts clues and ${cluesData.longsClues.length} / ${n} Longs clues.`;
      }
    }
  }

  // Generate the complete IPUZ JSON structure
  function generateIpuz() {
    const n = parseInt(sizeInput.value, 10);
    if (isNaN(n) || n < 2) return null;

    const title = (ipuzTitle ? ipuzTitle.value.trim() : '') || 'Shapeshifter';
    const author = ipuzAuthor ? ipuzAuthor.value.trim() : '';
    const copyright = ipuzCopyright ? ipuzCopyright.value.trim() : '';

    const solData = parseSolutionWords(ipuzSolutionInput ? ipuzSolutionInput.value : '', n);
    const cluesData = parseClues(ipuzCluesInput ? ipuzCluesInput.value : '', n);

    updateStatuses(n, solData, cluesData);

    const dims = n + 1;
    const puzzle = [];
    const solution = [];

    // Initialize (n+1) x (n+1) grid
    for (let r = 0; r <= n; r++) {
      const pRow = [];
      const sRow = [];
      for (let c = 0; c <= n; c++) {
        if ((r === 0 && c === n) || (r === n && c === 0)) {
          pRow.push(null);
          sRow.push(null);
        } else if (r + c === n) {
          pRow.push('#');
          sRow.push('#');
        } else {
          pRow.push(0);
          sRow.push(null);
        }
      }
      puzzle.push(pRow);
      solution.push(sRow);
    }

    // Fill solution letters from shorts
    if (solData.shorts.length > 0) {
      for (let r = 0; r <= n; r++) {
        const word = solData.shorts[r];
        if (!word) continue;
        let idx = 0;
        // Upper-Left part
        if (r < n) {
          for (let c = 0; c <= n - 1 - r; c++) {
            if (idx < word.length) solution[r][c] = word[idx++];
          }
        }
        // Lower-Right part
        if (r > 0) {
          for (let c = n - r + 1; c <= n; c++) {
            if (idx < word.length) solution[r][c] = word[idx++];
          }
        }
      }
    }

    // Clues with explicit 1-based [x, y] cells
    // Shorts (Horizontal): (n + 1) rows
    const shortsList = [];
    for (let r = 0; r <= n; r++) {
      const cells = [];
      if (r < n) {
        for (let c = 0; c <= n - 1 - r; c++) {
          cells.push([c + 1, r + 1]);
        }
      }
      if (r > 0) {
        for (let c = n - r + 1; c <= n; c++) {
          cells.push([c + 1, r + 1]);
        }
      }
      const clueText = cluesData.shortsClues[r] || '';
      shortsList.push({
        number: r + 1,
        clue: clueText,
        cells: cells
      });
    }

    // Longs (Vertical): n rows
    const longsList = [];
    for (let r = 0; r < n; r++) {
      const cells = [];
      // UL row r: cols 0 .. n-1-r
      for (let c = 0; c <= n - 1 - r; c++) {
        cells.push([c + 1, r + 1]);
      }
      // LR row r+1: cols n-r .. n
      for (let c = n - r; c <= n; c++) {
        cells.push([c + 1, r + 2]);
      }
      const clueText = cluesData.longsClues[r] || '';
      longsList.push({
        number: r + 1,
        clue: clueText,
        cells: cells
      });
    }

    const ipuzData = {
      version: 'http://ipuz.org/v2',
      kind: ['http://ipuz.org/crossword#1'],
      dimensions: {
        width: dims,
        height: dims
      },
      title: title,
      author: author,
      copyright: copyright,
      puzzle: puzzle,
      solution: solution,
      clues: {
        [`Shorts (${n})`]: shortsList,
        [`Longs (${n + 1})`]: longsList
      }
    };

    if (ipuzJsonOutput) {
      ipuzJsonOutput.value = JSON.stringify(ipuzData, null, 2);
    }

    return ipuzData;
  }

  // IPUZ Event Listeners
  if (ipuzTitle) ipuzTitle.addEventListener('input', generateIpuz);
  if (ipuzAuthor) ipuzAuthor.addEventListener('input', generateIpuz);
  if (ipuzCopyright) ipuzCopyright.addEventListener('input', generateIpuz);
  if (ipuzSolutionInput) ipuzSolutionInput.addEventListener('input', generateIpuz);
  if (ipuzCluesInput) ipuzCluesInput.addEventListener('input', generateIpuz);

  // Copy IPUZ JSON
  if (ipuzCopyBtn) {
    ipuzCopyBtn.addEventListener('click', () => {
      const text = ipuzJsonOutput.value;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showIpuzCopiedState);
      } else {
        ipuzJsonOutput.select();
        document.execCommand('copy');
        showIpuzCopiedState();
      }
    });
  }

  function showIpuzCopiedState() {
    const orig = ipuzCopyBtn.innerHTML;
    ipuzCopyBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      Copied!
    `;
    ipuzCopyBtn.style.backgroundColor = '#16a34a';
    ipuzCopyBtn.style.color = '#ffffff';
    setTimeout(() => {
      ipuzCopyBtn.innerHTML = orig;
      ipuzCopyBtn.style.backgroundColor = '';
      ipuzCopyBtn.style.color = '';
    }, 1800);
  }

  // Download .ipuz file
  if (ipuzDownloadBtn) {
    ipuzDownloadBtn.addEventListener('click', () => {
      const ipuzObj = generateIpuz();
      if (!ipuzObj) return;
      const jsonText = JSON.stringify(ipuzObj, null, 2);
      const titleSlug = (ipuzObj.title || 'shapeshifter').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${titleSlug}.ipuz`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
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
