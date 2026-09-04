/**
 * Acrostic Solver using HiGHS
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
   * Filter candidates from the wordlist string
   * wordlistText: newline-separated "word;score"
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

    // Precompute quote letter frequencies and norm
    const totalQ = quoteAlpha.length;
    const quoteFreq = {};
    let sumSqQ = 0;
    for (const ch in qctr) {
      const freq = qctr[ch] / totalQ;
      quoteFreq[ch] = freq;
      sumSqQ += freq * freq;
    }
    const normQ = Math.sqrt(sumSqQ);

    const candidatesByLetter = {};
    for (const ch in sctr) {
      candidatesByLetter[ch] = [];
    }

    const lines = wordlistText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const semi = line.indexOf(';');
      let word, score;
      if (semi !== -1) {
        word = line.slice(0, semi).toLowerCase().trim();
        score = parseInt(line.slice(semi + 1), 10);
      } else {
        word = line.toLowerCase().trim();
        score = 100;
      }

      const wordAlpha = alphaOnly(word);
      if (wordAlpha.length < minLen || wordAlpha.length > maxLen) continue;
      if (score < minScore) continue;

      const first = wordAlpha[0];
      if (!candidatesByLetter[first]) continue;
      if (excludedSet.has(wordAlpha)) continue;

      // Check if word[1:] is a multiset subset of quote letters
      if (!isSubstring(wordAlpha.slice(1), quoteAlpha)) continue;

      const fit = letterFitScore(wordAlpha, quoteFreq, normQ);
      candidatesByLetter[first].push({ word: wordAlpha, fit });
    }

    // Prune candidates if maxCandidatesPerLetter is specified
    const selectedWords = [];
    const seen = new Set();

    for (const ch in candidatesByLetter) {
      let list = candidatesByLetter[ch];
      if (maxCandidatesPerLetter && list.length > maxCandidatesPerLetter) {
        list.sort((a, b) => b.fit - a.fit);
        list = list.slice(0, maxCandidatesPerLetter);
      }
      for (let j = 0; j < list.length; j++) {
        const w = list[j].word;
        if (!seen.has(w)) {
          seen.add(w);
          selectedWords.push(w);
        }
      }
    }

    return selectedWords;
  }

  /**
   * Build the CPLEX LP string for HiGHS
   */
  function buildLpString(quoteAlpha, sourceAlpha, candidateWords) {
    const qctr = getLetterCounts(quoteAlpha);
    const sctr = getLetterCounts(sourceAlpha);

    // Map each candidate word to index
    const N = candidateWords.length;
    if (N === 0) return null;

    // Count letter appearances in each candidate word
    // wordLetterCounts[j][char] = count
    const wordLetterCounts = new Array(N);
    const wordsByInitial = {};
    for (let j = 0; j < N; j++) {
      const w = candidateWords[j];
      wordLetterCounts[j] = getLetterCounts(w);
      const first = w[0];
      if (!wordsByInitial[first]) wordsByInitial[first] = [];
      wordsByInitial[first].push(j);
    }

    const lines = [];
    lines.push('Minimize');
    lines.push('  obj: 0');
    lines.push('Subject To');

    // 1. Letter usage rows for each letter present in quote
    const letters = Object.keys(qctr).sort();
    for (let li = 0; li < letters.length; li++) {
      const ch = letters[li];
      const targetCount = qctr[ch];
      const terms = [];

      for (let j = 0; j < N; j++) {
        const cnt = wordLetterCounts[j][ch];
        if (cnt) {
          terms.push(cnt === 1 ? `x${j}` : `${cnt} x${j}`);
        }
      }

      if (terms.length === 0) {
        // Impossible to satisfy letter count
        return null;
      }

      // Chunk line to avoid excessively long lines
      let rowStr = `  let_${ch}: `;
      for (let t = 0; t < terms.length; t++) {
        rowStr += (t > 0 ? ' + ' : '') + terms[t];
        if (rowStr.length > 500 && t < terms.length - 1) {
          lines.push(rowStr);
          rowStr = '   ';
        }
      }
      rowStr += ` = ${targetCount}`;
      lines.push(rowStr);
    }

    // 2. First letter usage rows for each initial in source
    const initials = Object.keys(sctr).sort();
    for (let si = 0; si < initials.length; si++) {
      const ch = initials[si];
      const targetCount = sctr[ch];
      const indices = wordsByInitial[ch] || [];

      if (indices.length === 0) {
        return null;
      }

      let rowStr = `  init_${ch}: `;
      for (let t = 0; t < indices.length; t++) {
        rowStr += (t > 0 ? ' + ' : '') + `x${indices[t]}`;
        if (rowStr.length > 500 && t < indices.length - 1) {
          lines.push(rowStr);
          rowStr = '   ';
        }
      }
      rowStr += ` = ${targetCount}`;
      lines.push(rowStr);
    }

    // Binary variables
    lines.push('Binary');
    let binLine = ' ';
    for (let j = 0; j < N; j++) {
      binLine += ` x${j}`;
      if (binLine.length > 200) {
        lines.push(binLine);
        binLine = ' ';
      }
    }
    if (binLine.trim()) {
      lines.push(binLine);
    }
    lines.push('End');

    return lines.join('\n');
  }

  /**
   * Solve acrostic using HiGHS instance
   */
  function createAcrostic(quote, source, options, highsInstance) {
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
      const minLen = Math.max(1, Math.floor(meanLen - lenDistance));
      const maxLen = Math.ceil(meanLen + lenDistance);
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

      const lpProblem = buildLpString(quoteAlpha2, sourceAlpha2, candidates);
      if (!lpProblem) {
        return [];
      }

      const solution = highsInstance.solve(lpProblem, {
        presolve: 'on',
        output_flag: false
      });

      if (!solution || solution.Status !== 'Optimal') {
        return [];
      }

      for (let j = 0; j < candidates.length; j++) {
        const col = solution.Columns[`x${j}`];
        if (col && Math.round(col.Primal) === 1) {
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
    buildLpString,
    createAcrostic
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AcrosticSolver;
  }
  global.AcrosticSolver = AcrosticSolver;
})(typeof self !== 'undefined' ? self : this);
