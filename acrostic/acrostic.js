// HiGHS Acrostic Controller
(function () {
  'use strict';

  let worker = null;
  let isReady = false;
  let isSolving = false;
  let solveResolve = null;
  let defaultDictText = '';
  let currentSolution = [];

  const spinner = document.getElementById('spinner');
  const loadingText = document.getElementById('loading-text');
  const controls = document.getElementById('controls');
  const solveBtn = document.getElementById('solve-btn');
  const quoteInput = document.getElementById('quote-input');
  const sourceInput = document.getElementById('source-input');
  const quoteCount = document.getElementById('quote-count');
  const sourceCount = document.getElementById('source-count');
  const resultsCard = document.getElementById('results-card');
  const wordListVisual = document.getElementById('word-list-visual');
  const timeBadge = document.getElementById('time-badge');
  const copyBtn = document.getElementById('copy-btn');
  const outputEl = document.getElementById('output');

  function alphaCount(str) {
    return (str || '').replace(/[^a-zA-Z]/g, '').length;
  }

  function updateCounters() {
    if (quoteCount) {
      const qLen = alphaCount(quoteInput.value);
      quoteCount.textContent = `${qLen} letter${qLen === 1 ? '' : 's'}`;
    }
    if (sourceCount) {
      const sLen = alphaCount(sourceInput.value);
      sourceCount.textContent = `${sLen} letter${sLen === 1 ? '' : 's'}`;
    }
  }

  quoteInput.addEventListener('input', updateCounters);
  sourceInput.addEventListener('input', updateCounters);

  // Initialize Web Worker
  function initWorker() {
    worker = new Worker('highs/worker.js');

    worker.onmessage = function (e) {
      const msg = e.data || {};

      if (msg.type === 'ready') {
        // Ready in worker
      } else if (msg.type === 'wordlist_cached') {
        isReady = true;
        if (spinner) spinner.style.display = 'none';
        if (loadingText) loadingText.style.display = 'none';
        if (controls) controls.style.display = 'block';
      } else if (msg.type === 'progress') {
        if (isSolving && solveBtn) {
          solveBtn.querySelector('span').textContent = msg.message;
        }
      } else if (msg.type === 'result') {
        isSolving = false;
        solveBtn.disabled = false;
        solveBtn.querySelector('span').textContent = 'Create Acrostic';

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

  // Options support
  window.setCustomWordlist = function (text) {
    if (worker) {
      worker.postMessage({ type: 'set_wordlist', text: text });
    }
  };

  window.resetDefaultWordlist = function () {
    if (worker && defaultDictText) {
      worker.postMessage({ type: 'set_wordlist', text: defaultDictText });
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
      const decompressed = fflate.gunzipSync(new Uint8Array(buf));
      const dictText = fflate.strFromU8(decompressed);
      defaultDictText = dictText;

      loadingText.textContent = 'Initializing HiGHS solver...';
      worker.postMessage({ type: 'set_wordlist', text: dictText });
    } catch (err) {
      console.error('Initialization error:', err);
      loadingText.textContent = 'Failed to load dictionary: ' + err.message;
    }
  }

  // Copy results to clipboard
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      if (!currentSolution || currentSolution.length === 0) return;
      const text = currentSolution.map(w => w.toUpperCase()).join('\n');
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy Words';
        }, 2000);
      } catch {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy Words';
        }, 2000);
      }
    });
  }

  // Handle solve submission
  solveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!isReady || isSolving) return;

    const quote = quoteInput.value.trim();
    const source = sourceInput.value.trim();

    const exclStr = document.getElementById('excluded-input').value;
    const excluded = exclStr.trim().split(',').map(s => s.trim()).filter(Boolean);

    const inclStr = document.getElementById('included-input').value;
    const included = inclStr.trim().split(',').map(s => s.trim()).filter(Boolean);

    if (!quote || !source) {
      alert('Please enter both a quote and a source.');
      return;
    }

    isSolving = true;
    solveBtn.disabled = true;
    solveBtn.querySelector('span').textContent = 'Solving...';

    // Show results section in pending state
    resultsCard.style.display = 'block';
    wordListVisual.innerHTML = '<div style="color: var(--color-text-muted); padding: 16px 0; text-align: center;">Searching for matching words...</div>';
    timeBadge.textContent = 'Solving...';
    timeBadge.style.backgroundColor = 'var(--color-primary-light)';
    timeBadge.style.color = 'var(--color-primary)';
    if (copyBtn) copyBtn.style.display = 'none';

    const solvePromise = new Promise((resolve) => {
      solveResolve = resolve;
    });

    const opts = window.solverOptions || {};
    worker.postMessage({
      type: 'solve',
      quote: quote,
      source: source,
      excluded: excluded,
      included: included,
      minScore: opts.minScore !== undefined ? opts.minScore : 50,
      lenDistance: opts.lenDistance !== undefined ? opts.lenDistance : 3
    });

    const result = await solvePromise;

    if (result.success) {
      const elapsedSec = (result.elapsedMs / 1000).toFixed(2);
      timeBadge.textContent = `⚡ ${elapsedSec}s`;
      timeBadge.style.backgroundColor = 'var(--color-success-light)';
      timeBadge.style.color = 'var(--color-success)';

      if (result.solution && result.solution.length > 0) {
        currentSolution = result.solution;
        if (copyBtn) copyBtn.style.display = 'inline-flex';

        // Render visual cards
        let html = '';
        for (let i = 0; i < result.solution.length; i++) {
          const w = result.solution[i].toUpperCase();
          const initial = w[0];
          html += `
            <div class="word-item">
              <span class="word-initial">${initial}</span>
              <span class="word-text">${w}</span>
              <span class="word-len">${w.length} letters</span>
            </div>
          `;
        }
        wordListVisual.innerHTML = html;

        if (outputEl) {
          outputEl.textContent = result.solution.map(w => w.toUpperCase()).join('\n');
        }
      } else {
        currentSolution = [];
        if (copyBtn) copyBtn.style.display = 'none';
        wordListVisual.innerHTML = `
          <div style="color: var(--color-text-muted); padding: 16px; text-align: center; line-height: 1.6;">
            <strong>No solutions found.</strong><br/>
            Try increasing the <em>length distance</em> in Options or adjusting your quote/source letters.
          </div>
        `;
      }
    } else {
      currentSolution = [];
      if (copyBtn) copyBtn.style.display = 'none';
      timeBadge.textContent = 'Error';
      timeBadge.style.backgroundColor = 'var(--color-danger-light)';
      timeBadge.style.color = 'var(--color-danger)';
      wordListVisual.innerHTML = `
        <div style="color: var(--color-danger); padding: 14px; background: var(--color-danger-light); border-radius: 8px;">
          ${result.error}
        </div>
      `;
    }
  });

  // Start initialization
  init();
})();
