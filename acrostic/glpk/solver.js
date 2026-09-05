/**
 * Acrostic Solver using GLPK (glpk.js WebAssembly)
 * Port of acrostic_glp.py logic to JavaScript
 */

(function (global) {
  'use strict';

  const MIN_SCORE = 50;
  const LEN_DISTANCE = 3;

  function alphaOnly(s) {
    return (s || '').toLowerCase().replace(/[^a-z]/g, '');
  }

  function getLetterCounts(str) {
    const counts = {};
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      counts[ch] = (counts[ch] || 0) + 1;
    }
    return counts;
  }

  function isSubstring(s1, s2) {
    // True if all letters of s1 appear in s2 with at least the same frequency
    const c1 = getLetterCounts(s1);
    const c2 = getLetterCounts(s2);
    for (const ch in c1) {
      if ((c2[ch] || 0) < c1[ch]) {
        return false;
      }
    }
    return true;
  }

  function removeString(s1, s2) {
    let s3 = alphaOnly(s2);
    for (const ch of alphaOnly(s1)) {
      s3 = s3.replace(ch, '');
    }
    return s3;
  }

  function letterFitScore(word, quoteFreq, normQ) {
    // word[1:]: skip first letter
    const remainder = word.slice(1);
    if (remainder.length === 0) return 0;

    const wc = getLetterCounts(remainder);
    const totalW = remainder.length;

    let dot = 0;
    let sumSqW = 0;
    for (const ch in wc) {
      const freqW = wc[ch] / totalW;
      sumSqW += freqW * freqW;
      if (quoteFreq[ch]) {
        dot += freqW * quoteFreq[ch];
      }
    }

    const normW = Math.sqrt(sumSqW);
    return dot / (normW * normQ + 1e-9);
  }

  /**
   * Filter candidates from wordlist
   */
  function filterCandidates(
    wordlistText,
    sourceAlpha,
    quoteAlpha,
    minLen,
    maxLen,
    minScore,
    excludedSet,
    maxCandidatesPerLetter
  ) {
    const sctr = getLetterCounts(sourceAlpha);
    const qctr = getLetterCounts(quoteAlpha);
    const totalQ = quoteAlpha.length;

    // Remaining letters pool after reserving initials for source
    const remainderPool = removeString(sourceAlpha, quoteAlpha);
    const remCtr = getLetterCounts(remainderPool);

    const quoteFreq = {};
    let sumSqQ = 0;
    for (const ch in qctr) {
      const f = qctr[ch] / totalQ;
      quoteFreq[ch] = f;
      sumSqQ += f * f;
    }
    const normQ = Math.sqrt(sumSqQ);

    const candidatesByInitial = {};
    for (const ch in sctr) {
      candidatesByInitial[ch] = [];
    }

    // Process wordlist line by line
    let lineStart = 0;
    const len = wordlistText.length;

    while (lineStart < len) {
      let lineEnd = wordlistText.indexOf('\n', lineStart);
      if (lineEnd === -1) lineEnd = len;

      const line = wordlistText.slice(lineStart, lineEnd).trim();
      lineStart = lineEnd + 1;
      if (!line) continue;

      const semiIdx = line.indexOf(';');
      if (semiIdx === -1) continue;

      const rawWord = line.slice(0, semiIdx).trim().toLowerCase();
      const rawScore = parseInt(line.slice(semiIdx + 1).trim(), 10);

      if (isNaN(rawScore) || rawScore < minScore) continue;
      const wLen = rawWord.length;
      if (wLen < minLen || wLen > maxLen) continue;

      const init = rawWord[0];
      if (!sctr[init]) continue;
      if (excludedSet && excludedSet.has(rawWord)) continue;

      // Check substring of remainder in available remainder pool (quote minus source initials)
      const remainder = rawWord.slice(1);
      const wc = getLetterCounts(remainder);
      let fits = true;
      for (const ch in wc) {
        if ((remCtr[ch] || 0) < wc[ch]) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;

      const fit = letterFitScore(rawWord, quoteFreq, normQ);
      candidatesByInitial[init].push({ word: rawWord, fit: fit, score: rawScore });
    }

    // Collect candidates (with optional density pruning per letter)
    const resultWords = [];
    for (const init in candidatesByInitial) {
      let list = candidatesByInitial[init];
      if (maxCandidatesPerLetter && list.length > maxCandidatesPerLetter) {
        list = pruneCandidatesByDensity(list, maxCandidatesPerLetter);
      }
      for (let i = 0; i < list.length; i++) {
        resultWords.push(list[i].word);
      }
    }

    return resultWords;
  }

  /**
   * Deterministic 32-bit string hash returning a float in (0, 1)
   */
  function stringHash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h + 1) / 4294967297;
  }

  /**
   * Prune candidate words using deterministic density-weighted reservoir sampling.
   * Words farther from the letter centroid have higher probability of retention,
   * thinning out generic crowded words while preserving rare letter combinations.
   */
  function pruneCandidatesByDensity(list, maxK) {
    if (!maxK || list.length <= maxK) return list;

    const N = list.length;
    const vectors = new Array(N);
    const centroid = {};

    for (let i = 0; i < N; i++) {
      const counts = getLetterCounts(list[i].word);
      vectors[i] = counts;
      for (const ch in counts) {
        centroid[ch] = (centroid[ch] || 0) + counts[ch];
      }
    }

    let centroidNormSq = 0;
    for (const ch in centroid) {
      centroid[ch] /= N;
      centroidNormSq += centroid[ch] * centroid[ch];
    }
    const centroidNorm = Math.sqrt(centroidNormSq) || 1e-9;

    const scored = new Array(N);
    for (let i = 0; i < N; i++) {
      const counts = vectors[i];
      let dot = 0;
      let normSq = 0;
      for (const ch in counts) {
        normSq += counts[ch] * counts[ch];
        if (centroid[ch]) {
          dot += counts[ch] * centroid[ch];
        }
      }
      const normW = Math.sqrt(normSq) || 1e-9;
      const cosSim = dot / (normW * centroidNorm);
      const dist = Math.max(0.01, 1 - cosSim);

      const scoreWeight = list[i].score ? list[i].score / 50 : 1.0;
      const weight = dist * scoreWeight;

      const u = stringHash(list[i].word);
      const key = Math.pow(u, 1 / weight);
      scored[i] = { candidate: list[i], key: key };
    }

    scored.sort((a, b) => b.key - a.key);
    return scored.slice(0, maxK).map(x => x.candidate);
  }

  /**
   * Build the GLPK JSON problem model
   */
  function buildLpModel(quoteAlpha, sourceAlpha, candidateWords, glpk) {
    const qctr = getLetterCounts(quoteAlpha);
    const sctr = getLetterCounts(sourceAlpha);

    const N = candidateWords.length;
    if (N === 0) return null;

    const wordLetterCounts = new Array(N);
    const wordsByInitial = {};
    for (let j = 0; j < N; j++) {
      const w = candidateWords[j];
      wordLetterCounts[j] = getLetterCounts(w);
      const first = w[0];
      if (!wordsByInitial[first]) wordsByInitial[first] = [];
      wordsByInitial[first].push(j);
    }

    const subjectTo = [];

    // 1. Quote letter usage constraints
    const letters = Object.keys(qctr).sort();
    for (let li = 0; li < letters.length; li++) {
      const ch = letters[li];
      const targetCount = qctr[ch];
      const vars = [];

      for (let j = 0; j < N; j++) {
        const cnt = wordLetterCounts[j][ch];
        if (cnt) {
          vars.push({ name: `x${j}`, coef: cnt });
        }
      }

      if (vars.length === 0) {
        // Impossible to satisfy letter count
        return null;
      }

      subjectTo.push({
        name: `let_${ch}`,
        vars,
        bnds: { type: glpk.GLP_FX, ub: targetCount, lb: targetCount }
      });
    }

    // 2. Source initial constraints
    const initials = Object.keys(sctr).sort();
    for (let si = 0; si < initials.length; si++) {
      const ch = initials[si];
      const targetCount = sctr[ch];
      const indices = wordsByInitial[ch] || [];

      if (indices.length === 0) {
        return null;
      }

      const vars = indices.map(j => ({ name: `x${j}`, coef: 1.0 }));
      subjectTo.push({
        name: `init_${ch}`,
        vars,
        bnds: { type: glpk.GLP_FX, ub: targetCount, lb: targetCount }
      });
    }

    const binaries = candidateWords.map((_, j) => `x${j}`);

    return {
      name: 'acrostic',
      objective: {
        direction: glpk.GLP_MIN,
        name: 'obj',
        vars: []
      },
      subjectTo,
      binaries
    };
  }

  /**
   * Solve acrostic using GLPK instance
   */
  function createAcrostic(quote, source, options, glpkInstance) {
    const excludedWords = (options.excluded || []).map(alphaOnly).filter(Boolean);
    const includedWords = (options.included || []).map(alphaOnly).filter(Boolean);
    const minScore = options.minScore !== undefined ? options.minScore : MIN_SCORE;
    const lenDistance = options.lenDistance !== undefined ? options.lenDistance : LEN_DISTANCE;
    const maxCandidatesPerLetter = options.maxCandidatesPerLetter || null;
    const wordlistText = options.wordlistText;

    if (!wordlistText) {
      throw new Error('Wordlist text is required.');
    }

    const s1 = alphaOnly(source);
    const s2 = alphaOnly(quote);
    if (!isSubstring(s1, s2)) {
      throw new Error('Source is not contained in quote');
    }

    // If there are included words, reserve their letters and initials
    let quote2 = quote;
    let source2 = s1;
    if (includedWords.length > 0) {
      const includedAlpha = includedWords.join('');
      quote2 = removeString(includedAlpha, quote);
      const firstLetters = includedWords.map(w => w[0]).join('');
      source2 = removeString(firstLetters, source2);
    }

    const sourceAlpha2 = alphaOnly(source2);
    const quoteAlpha2 = alphaOnly(quote2);

    let chosenReducedWords = [];
    if (sourceAlpha2.length > 0) {
      const meanLen = quoteAlpha2.length / sourceAlpha2.length;
      const minLen = Math.max(1, Math.ceil(meanLen - lenDistance));
      const maxLen = Math.max(minLen, Math.floor(meanLen + lenDistance));
      const excludedSet = new Set(excludedWords);

      const candidates = filterCandidates(
        wordlistText,
        sourceAlpha2,
        quoteAlpha2,
        minLen,
        maxLen,
        minScore,
        excludedSet,
        maxCandidatesPerLetter
      );

      if (candidates.length < sourceAlpha2.length) {
        return [];
      }

      const lpModel = buildLpModel(quoteAlpha2, sourceAlpha2, candidates, glpkInstance);
      if (!lpModel) {
        return [];
      }

      const res = glpkInstance.solve(lpModel, {
        presol: true,
        msglev: glpkInstance.GLP_MSG_OFF
      });

      if (!res || !res.result || (res.result.status !== glpkInstance.GLP_OPT && res.result.status !== glpkInstance.GLP_FEAS)) {
        return [];
      }

      for (let j = 0; j < candidates.length; j++) {
        if (res.result.vars[`x${j}`] === 1) {
          chosenReducedWords.push(candidates[j]);
        }
      }
    }

    // Merge included words into the solution and order them according to source
    const allWords = chosenReducedWords.concat(includedWords);
    const finalSolution = [];
    const sourceFull = alphaOnly(source);

    for (let i = 0; i < sourceFull.length; i++) {
      const initial = sourceFull[i];
      const matchIdx = allWords.findIndex(w => w[0] === initial);
      if (matchIdx !== -1) {
        finalSolution.push(allWords[matchIdx]);
        allWords.splice(matchIdx, 1);
      } else {
        return [];
      }
    }

    return finalSolution;
  }

  // Export
  const AcrosticSolver = {
    alphaOnly,
    getLetterCounts,
    isSubstring,
    removeString,
    letterFitScore,
    filterCandidates,
    pruneCandidatesByDensity,
    buildLpModel,
    createAcrostic
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AcrosticSolver;
  }
  global.AcrosticSolver = AcrosticSolver;
})(typeof self !== 'undefined' ? self : this);
