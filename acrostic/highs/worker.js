/**
 * Web Worker for Acrostic HiGHS Solver
 */

/* global importScripts, Module, AcrosticSolver */

importScripts('highs.js');
importScripts('solver.js');

let highsInstance = null;
let cachedWordlist = null;

const initPromise = Module({
  locateFile: (file) => file
}).then(instance => {
  highsInstance = instance;
  self.postMessage({ type: 'ready' });
  return instance;
}).catch(err => {
  self.postMessage({ type: 'error', error: 'Failed to initialize HiGHS: ' + err.message });
});

self.onmessage = async function (e) {
  const data = e.data || {};
  const msgType = data.type;

  if (msgType === 'set_wordlist') {
    cachedWordlist = data.text;
    self.postMessage({ type: 'wordlist_cached', length: cachedWordlist ? cachedWordlist.length : 0 });
    return;
  }

  if (msgType === 'solve') {
    const startTime = Date.now();
    try {
      if (!highsInstance) {
        self.postMessage({ type: 'progress', message: 'Initializing solver...' });
        highsInstance = await initPromise;
      }

      const wordlistText = data.wordlistText || cachedWordlist;
      if (!wordlistText) {
        throw new Error('No wordlist loaded.');
      }

      self.postMessage({ type: 'progress', message: 'Filtering candidate words...' });

      // Run solver
      const solution = AcrosticSolver.createAcrostic(data.quote, data.source, {
        wordlistText: wordlistText,
        excluded: data.excluded || [],
        included: data.included || [],
        minScore: data.minScore !== undefined ? data.minScore : 50,
        lenDistance: data.lenDistance !== undefined ? data.lenDistance : 3,
        maxCandidatesPerLetter: data.maxCandidatesPerLetter || null
      }, highsInstance);

      const elapsedMs = Date.now() - startTime;
      self.postMessage({
        type: 'result',
        success: true,
        solution: solution,
        elapsedMs: elapsedMs
      });
    } catch (err) {
      const elapsedMs = Date.now() - startTime;
      self.postMessage({
        type: 'result',
        success: false,
        error: err.message || String(err),
        elapsedMs: elapsedMs
      });
    }
  }
};
