/**
 * Web Worker for Acrostic Solver using glpk.js
 */

import GLPK from './glpk.js';
import './solver.js';

let glpkInstance = null;
let cachedWordlist = null;

async function getGlpk() {
  if (glpkInstance) return glpkInstance;
  const wasmUrl = new URL('glpk.wasm', import.meta.url);
  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(`Failed to load glpk.wasm (${response.status} ${response.statusText})`);
  }
  const wasmBinary = await response.arrayBuffer();
  glpkInstance = await GLPK({ wasmBinary });
  return glpkInstance;
}

const initPromise = getGlpk().then(instance => {
  self.postMessage({ type: 'ready' });
  return instance;
}).catch(err => {
  console.error('GLPK initialization error:', err);
  self.postMessage({ type: 'error', error: 'Failed to initialize GLPK: ' + (err.message || err) });
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
      if (!glpkInstance) {
        self.postMessage({ type: 'progress', message: 'Initializing solver...' });
        glpkInstance = await initPromise;
      }

      const wordlistText = data.wordlistText || cachedWordlist;
      if (!wordlistText) {
        throw new Error('No wordlist loaded.');
      }

      self.postMessage({ type: 'progress', message: 'Filtering candidate words...' });

      const solution = self.AcrosticSolver.createAcrostic(data.quote, data.source, {
        wordlistText: wordlistText,
        excluded: data.excluded || [],
        included: data.included || [],
        minScore: data.minScore !== undefined ? data.minScore : 50,
        lenDistance: data.lenDistance !== undefined ? data.lenDistance : 3,
        maxCandidatesPerLetter: data.maxCandidatesPerLetter || null
      }, glpkInstance);

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
