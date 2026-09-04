// HiGHS Acrostic Controller
(function () {
  'use strict';

  let worker = null;
  let isReady = false;
  let isSolving = false;
  let solveResolve = null;

  const spinner = document.getElementById('spinner');
  const loadingText = document.getElementById('loading-text');
  const controls = document.getElementById('controls');
  const solveBtn = document.getElementById('solve-btn');
  const outputEl = document.getElementById('output');

  // Initialize Worker
  function initWorker() {
    worker = new Worker('highs/worker.js');

    worker.onmessage = function (e) {
      const msg = e.data || {};

      if (msg.type === 'ready') {
        // Solver is ready in worker
      } else if (msg.type === 'wordlist_cached') {
        isReady = true;
        if (spinner) spinner.style.display = 'none';
        if (loadingText) loadingText.style.display = 'none';
        if (controls) controls.style.display = 'block';
      } else if (msg.type === 'progress') {
        if (outputEl && isSolving) {
          outputEl.textContent = msg.message + '\n';
        }
      } else if (msg.type === 'result') {
        isSolving = false;
        solveBtn.disabled = false;
        solveBtn.textContent = 'Create acrostic';

        if (solveResolve) {
          solveResolve(msg);
          solveResolve = null;
        }
      } else if (msg.type === 'error') {
        console.error('Worker error:', msg.error);
        if (loadingText) loadingText.textContent = 'Error loading solver: ' + msg.error;
      }
    };

    worker.onerror = function (err) {
      console.error('Worker error event:', err);
      if (loadingText) loadingText.textContent = 'Error starting Web Worker: ' + (err.message || 'Check console');
    };
  }

  // Allow custom word list upload from wordlist.js
  window.setCustomWordlist = function (text) {
    if (worker) {
      worker.postMessage({ type: 'set_wordlist', text: text });
      alert('Custom wordlist loaded (' + text.split('\n').length.toLocaleString() + ' words).');
    }
  };

  // Bootstrap dictionary and worker
  async function init() {
    initWorker();

    try {
      loadingText.textContent = 'Loading wordlist...';
      const resp = await fetch('spreadthewordlist.dict.gz');
      const buf = await resp.arrayBuffer();

      loadingText.textContent = 'Decompressing wordlist...';
      const compressed = new Uint8Array(buf);
      const dictText = pako.ungzip(compressed, { to: 'string' });

      loadingText.textContent = 'Initializing HiGHS solver...';
      worker.postMessage({ type: 'set_wordlist', text: dictText });
    } catch (err) {
      console.error('Initialization error:', err);
      loadingText.textContent = 'Failed to load dictionary: ' + err.message;
    }
  }

  // Handle solve submission
  solveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!isReady || isSolving) return;

    const quote = document.getElementById('quote-input').value;
    const source = document.getElementById('source-input').value;

    const exclStr = document.getElementById('excluded-input').value;
    const excluded = exclStr.trim().split(',').map(s => s.trim()).filter(Boolean);

    const inclStr = document.getElementById('included-input').value;
    const included = inclStr.trim().split(',').map(s => s.trim()).filter(Boolean);

    if (!quote.trim() || !source.trim()) {
      outputEl.textContent = 'Please enter both a quote and a source.';
      return;
    }

    isSolving = true;
    solveBtn.disabled = true;
    solveBtn.textContent = 'Solving...';
    outputEl.textContent = 'Preparing problem...\n';

    const solvePromise = new Promise((resolve) => {
      solveResolve = resolve;
    });

    worker.postMessage({
      type: 'solve',
      quote: quote,
      source: source,
      excluded: excluded,
      included: included
    });

    const result = await solvePromise;

    if (result.success) {
      if (result.solution && result.solution.length > 0) {
        const formatted = result.solution.map(w => w.toUpperCase()).join('\n');
        const elapsedSec = (result.elapsedMs / 1000).toFixed(2);
        outputEl.textContent = `${formatted}\n\n[Solved in ${elapsedSec}s]`;
      } else {
        outputEl.textContent = 'No solutions found.';
      }
    } else {
      outputEl.textContent = 'Error: ' + result.error;
    }
  });

  // Start initialization
  init();
})();
