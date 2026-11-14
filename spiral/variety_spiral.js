/**
 * Variety Spiral Construction Helper
 * ==================================
 * Interactive constructor for variety spirals where:
 *   - N forward words enter without gaps (cells 1 to L)
 *   - M + 1 backward words enter in reverse, separated by M single-letter gaps
 *   - The gaps in backward order spell out target word W.
 */

// Global State
let wordScores = {};           // WORD -> score
let fwdByPrefix = {};          // prefix -> [WORD, ...]
let bwdBySuffix = {};          // suffix -> [WORD, ...]
let fwdWordsSet = new Set();
let bwdWordsSet = new Set();
let dataTable = null;

let currentN = 4;
let targetW = "FIRE";
let minScore = 50;
const MIN_FWD_LEN = 5;
const MAX_FWD_LEN = 15;
const MIN_BWD_LEN = 4;
const MAX_BWD_LEN = 15;

// History stack for Undo
let historyStack = [];

// Current puzzle state
// patWords[0] = B_M^R (ends at cell 1)
// patWords[1] = B_{M-1}^R ...
let state = {
  fwdWords: [],         // [F_0, F_1, ...]
  patWords: [],         // [R_0, R_1, ...] where R_k = B_{M-k}^R
  atGap: false,
  sFwd: "",
  sPat: "",
};

// ============================================================================
// [1] Dictionary Loading and Parsing
// ============================================================================

function parseDictText(text) {
  wordScores = {};
  const lines = text.split("\n");
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    let w, sc;
    if (line.includes(";")) {
      const parts = line.split(";");
      w = parts[0].trim().toUpperCase();
      sc = parseInt(parts[1].trim(), 10) || 50;
    } else {
      w = line.toUpperCase();
      sc = 50;
    }
    if (/^[A-Z]+$/.test(w)) {
      wordScores[w] = Math.max(wordScores[w] || 0, sc);
    }
  }
}

async function initDictionary() {
  const statusEl = document.getElementById("dictStatus");
  statusEl.textContent = "Loading spreadthewordlist.dict...";

  const dictCandidates = [
    "spreadthewordlist.dict",
    "../word_lists/spreadthewordlist.dict",
    "./helper_dict.json"
  ];

  let loaded = false;
  for (const path of dictCandidates) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;

      if (path.endsWith(".json")) {
        const data = await res.json();
        wordScores = {};
        for (const cat of ["begin", "end"]) {
          if (!data[cat]) continue;
          for (const key in data[cat]) {
            for (const entry of data[cat][key]) {
              const words = entry.words || [];
              const sc = entry.score || 50;
              for (const w of words) {
                if (w && typeof w === "string") {
                  const clean = w.trim().toUpperCase();
                  if (/^[A-Z]+$/.test(clean)) {
                    wordScores[clean] = Math.max(wordScores[clean] || 0, Math.round(sc / words.length));
                  }
                }
              }
            }
          }
        }
      } else {
        const text = await res.text();
        parseDictText(text);
      }

      loaded = true;
      statusEl.textContent = `Loaded ${Object.keys(wordScores).length.toLocaleString()} words.`;
      break;
    } catch (e) {
      // try next
    }
  }

  if (!loaded) {
    statusEl.innerHTML = "<span style='color:#f87171;'>Select wordlist file above to begin</span>";
  } else {
    buildIndexes();
    startNewPuzzle();
  }

  // Hook up manual file input
  const fileInput = document.getElementById("dictFileInput");
  if (fileInput) {
    fileInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (!file) return;
      statusEl.textContent = `Reading ${file.name}...`;
      const reader = new FileReader();
      reader.onload = function (evt) {
        const content = evt.target.result;
        if (file.name.endsWith(".json")) {
          const data = JSON.parse(content);
          wordScores = {};
          for (const cat of ["begin", "end"]) {
            if (!data[cat]) continue;
            for (const key in data[cat]) {
              for (const entry of data[cat][key]) {
                const words = entry.words || [];
                const sc = entry.score || 50;
                for (const w of words) {
                  if (w && typeof w === "string") {
                    const clean = w.trim().toUpperCase();
                    if (/^[A-Z]+$/.test(clean)) {
                      wordScores[clean] = Math.max(wordScores[clean] || 0, Math.round(sc / words.length));
                    }
                  }
                }
              }
            }
          }
        } else {
          parseDictText(content);
        }
        statusEl.textContent = `Loaded ${Object.keys(wordScores).length.toLocaleString()} words from ${file.name}.`;
        buildIndexes();
        startNewPuzzle();
      };
      reader.readAsText(file);
    });
  }
}

function buildIndexes() {
  fwdByPrefix = {};
  bwdBySuffix = {};
  fwdWordsSet = new Set();
  bwdWordsSet = new Set();

  const minSc = parseInt(document.getElementById("minScore").value, 10) || minScore;

  for (const [w, sc] of Object.entries(wordScores)) {
    if (sc < minSc) continue;
    const l = w.length;

    if (l >= MIN_FWD_LEN && l <= MAX_FWD_LEN) {
      fwdWordsSet.add(w);
      for (let i = 0; i <= l; i++) {
        const pref = w.slice(0, i);
        if (!fwdByPrefix[pref]) fwdByPrefix[pref] = [];
        fwdByPrefix[pref].push(w);
      }
    }

    if (l >= MIN_BWD_LEN && l <= MAX_BWD_LEN) {
      bwdWordsSet.add(w);
      for (let i = 0; i <= l; i++) {
        const suff = w.slice(l - i);
        if (!bwdBySuffix[suff]) bwdBySuffix[suff] = [];
        bwdBySuffix[suff].push(w);
      }
    }
  }

  // Sort lists by score descending
  for (const pref in fwdByPrefix) {
    fwdByPrefix[pref].sort((a, b) => (wordScores[b] || 0) - (wordScores[a] || 0));
  }
  for (const suff in bwdBySuffix) {
    bwdBySuffix[suff].sort((a, b) => (wordScores[b] || 0) - (wordScores[a] || 0));
  }
}

// ============================================================================
// [2] State Management & Undo
// ============================================================================

function saveState() {
  historyStack.push(JSON.parse(JSON.stringify(state)));
}

function undoLast() {
  if (historyStack.length === 0) return;
  state = historyStack.pop();
  updateUI();
  refreshCandidates();
}

function startNewPuzzle() {
  currentN = parseInt(document.getElementById("paramN").value, 10) || 2;
  targetW = (document.getElementById("paramW").value || "").trim().toUpperCase();

  if (!targetW || !/^[A-Z]+$/.test(targetW)) {
    alert("Please enter a valid secret word W (letters only).");
    return;
  }

  historyStack = [];
  state = {
    fwdWords: [],
    patWords: [],
    atGap: false,
    sFwd: "",
    sPat: "",
  };

  buildIndexes();
  updateUI();
  refreshCandidates();
}

// ============================================================================
// [3] Lookahead Search & Validation Engine
// ============================================================================

function getForwardGaps(wStr) {
  // Gaps in forward stream order: reverse of targetW
  return wStr.split("").reverse();
}

function hasValidCompletion(fwdWords, patWords, sFwd, sPat, atGap, usedWords, maxDepth = 6) {
  const M = targetW.length;
  const fwdGaps = getForwardGaps(targetW);

  const iFwd = fwdWords.length;
  const kPat = patWords.length;

  if (iFwd === currentN && kPat === M + 1 && !atGap && sFwd.length === sPat.length) {
    return true;
  }

  if (maxDepth <= 0) return true;

  const remFwd = currentN - iFwd;
  const remPat = (M + 1) - kPat;
  const remGaps = atGap ? (M - kPat + 1) : (M - kPat);

  const minFinalFwd = sFwd.length + remFwd * MIN_FWD_LEN;
  const maxFinalFwd = sFwd.length + remFwd * MAX_FWD_LEN;
  const minFinalPat = sPat.length + remGaps + remPat * MIN_BWD_LEN;
  const maxFinalPat = sPat.length + remGaps + remPat * MAX_BWD_LEN;

  if (minFinalFwd > maxFinalPat || minFinalPat > maxFinalFwd) {
    return false;
  }

  const delta = sFwd.length - sPat.length;

  if (atGap) {
    const gapChar = fwdGaps[kPat - 1];
    if (sPat.length < sFwd.length) {
      if (sFwd[sPat.length] !== gapChar) return false;
      return hasValidCompletion(fwdWords, patWords, sFwd, sPat + gapChar, false, usedWords, maxDepth - 1);
    } else {
      return hasValidCompletion(fwdWords, patWords, sFwd, sPat + gapChar, false, usedWords, maxDepth - 1);
    }
  }

  if (delta > 0) {
    if (kPat > M) return false;
    const remSlice = sFwd.slice(sPat.length);
    const reqLen = remSlice.length;

    for (let l = MIN_BWD_LEN; l <= Math.min(reqLen, MAX_BWD_LEN); l++) {
      const candB = remSlice.slice(0, l).split("").reverse().join("");
      if (bwdWordsSet.has(candB) && !usedWords.has(candB)) {
        usedWords.add(candB);
        const candR = candB.split("").reverse().join("");
        const nextAtGap = (kPat + 1 <= M);
        const ok = hasValidCompletion(fwdWords, patWords.concat([candR]), sFwd, sPat + candR, nextAtGap, usedWords, maxDepth - 1);
        usedWords.delete(candB);
        if (ok) return true;
      }
    }

    if (reqLen <= MAX_BWD_LEN) {
      const suff = remSlice.split("").reverse().join("");
      const list = bwdBySuffix[suff] || [];
      for (let i = 0; i < Math.min(list.length, 30); i++) {
        const candB = list[i];
        if (candB.length > reqLen && !usedWords.has(candB)) {
          usedWords.add(candB);
          const candR = candB.split("").reverse().join("");
          const nextAtGap = (kPat + 1 <= M);
          const ok = hasValidCompletion(fwdWords, patWords.concat([candR]), sFwd, sPat + candR, nextAtGap, usedWords, maxDepth - 1);
          usedWords.delete(candB);
          if (ok) return true;
        }
      }
    }
    return false;
  }

  if (iFwd >= currentN) return false;

  if (delta < 0) {
    const remSlice = sPat.slice(sFwd.length);
    const reqLen = remSlice.length;

    for (let l = MIN_FWD_LEN; l <= Math.min(reqLen, MAX_FWD_LEN); l++) {
      const candF = remSlice.slice(0, l);
      if (fwdWordsSet.has(candF) && !usedWords.has(candF)) {
        usedWords.add(candF);
        const ok = hasValidCompletion(fwdWords.concat([candF]), patWords, sFwd + candF, sPat, atGap, usedWords, maxDepth - 1);
        usedWords.delete(candF);
        if (ok) return true;
      }
    }

    if (reqLen <= MAX_FWD_LEN) {
      const list = fwdByPrefix[remSlice] || [];
      for (let i = 0; i < Math.min(list.length, 30); i++) {
        const candF = list[i];
        if (candF.length > reqLen && !usedWords.has(candF)) {
          usedWords.add(candF);
          const ok = hasValidCompletion(fwdWords.concat([candF]), patWords, sFwd + candF, sPat, atGap, usedWords, maxDepth - 1);
          usedWords.delete(candF);
          if (ok) return true;
        }
      }
    }
    return false;
  }

  const list = fwdByPrefix[""] || [];
  for (let i = 0; i < Math.min(list.length, 25); i++) {
    const candF = list[i];
    if (!usedWords.has(candF)) {
      usedWords.add(candF);
      const ok = hasValidCompletion(fwdWords.concat([candF]), patWords, sFwd + candF, sPat, atGap, usedWords, maxDepth - 1);
      usedWords.delete(candF);
      if (ok) return true;
    }
  }

  return false;
}

// ============================================================================
// [4] Candidate Generation with Verification
// ============================================================================

function computeCandidates() {
  const M = targetW.length;
  const fwdGaps = getForwardGaps(targetW);

  // If pattern is currently at gap, handle it
  if (state.atGap) {
    const kPat = state.patWords.length;
    const gapChar = fwdGaps[kPat - 1];

    if (state.sPat.length < state.sFwd.length) {
      if (state.sFwd[state.sPat.length] !== gapChar) {
        return { direction: "GAP_ERROR", items: [], gapChar };
      }
      state.sPat += gapChar;
      state.atGap = false;
      return computeCandidates();
    } else {
      state.sPat += gapChar;
      state.atGap = false;
      return computeCandidates();
    }
  }

  const delta = state.sFwd.length - state.sPat.length;
  const usedWords = new Set(state.fwdWords.concat(
    state.patWords.map(r => r.split("").reverse().join(""))
  ));

  // CASE 1: Forward has extra letters (delta > 0) -> pattern must catch up with backward word
  if (delta > 0) {
    const kPat = state.patWords.length;
    if (kPat > M) return { direction: "NONE", items: [] };

    const remSlice = state.sFwd.slice(state.sPat.length);
    const reqLen = remSlice.length;
    const rawCandidates = [];
    const seen = new Set();
    const nextGapChar = (kPat < M) ? fwdGaps[kPat] : null;

    function isGapCompatible(candLen) {
      if (!nextGapChar) return true;
      const gapPosInFwd = state.sPat.length + candLen;
      if (gapPosInFwd < state.sFwd.length) {
        return state.sFwd[gapPosInFwd] === nextGapChar;
      }
      return true;
    }

    for (let l = MIN_BWD_LEN; l <= Math.min(reqLen, MAX_BWD_LEN); l++) {
      const candB = remSlice.slice(0, l).split("").reverse().join("");
      if (bwdWordsSet.has(candB) && !usedWords.has(candB) && !seen.has(candB)) {
        if (isGapCompatible(l)) {
          seen.add(candB);
          rawCandidates.push({
            word: candB,
            direction: "Outward",
            length: l,
            leftover: reqLen - l > 0 ? remSlice.slice(l) : "(exact match)",
            score: wordScores[candB] || 0,
          });
        }
      }
    }

    if (reqLen <= MAX_BWD_LEN) {
      const suff = remSlice.split("").reverse().join("");
      const list = bwdBySuffix[suff] || [];
      for (const candB of list) {
        if (candB.length > reqLen && !usedWords.has(candB) && !seen.has(candB)) {
          if (isGapCompatible(candB.length)) {
            seen.add(candB);
            const r = candB.split("").reverse().join("");
            const excess = r.slice(reqLen);
            rawCandidates.push({
              word: candB,
              direction: "Outward",
              length: candB.length,
              leftover: "+" + excess.length + " letters ('" + excess + "')",
              score: wordScores[candB] || 0,
            });
          }
        }
      }
    }

    rawCandidates.sort((a, b) => b.score - a.score);
    const verified = [];
    for (const cand of rawCandidates) {
      const candR = cand.word.split("").reverse().join("");
      const nextAtGap = (kPat + 1 <= M);
      usedWords.add(cand.word);
      const ok = hasValidCompletion(
        state.fwdWords,
        state.patWords.concat([candR]),
        state.sFwd,
        state.sPat + candR,
        nextAtGap,
        usedWords
      );
      usedWords.delete(cand.word);
      if (ok) {
        verified.push(cand);
      }
    }

    return { direction: "OUTWARD", items: verified };
  }

  // CASE 2: Pattern has extra letters (delta < 0) -> forward must catch up
  if (delta < 0) {
    const iFwd = state.fwdWords.length;
    if (iFwd >= currentN) return { direction: "NONE", items: [] };

    const remSlice = state.sPat.slice(state.sFwd.length);
    const reqLen = remSlice.length;
    const rawCandidates = [];
    const seen = new Set();

    for (let l = MIN_FWD_LEN; l <= Math.min(reqLen, MAX_FWD_LEN); l++) {
      const candF = remSlice.slice(0, l);
      if (fwdWordsSet.has(candF) && !usedWords.has(candF) && !seen.has(candF)) {
        seen.add(candF);
        rawCandidates.push({
          word: candF,
          direction: "Inward",
          length: l,
          leftover: reqLen - l > 0 ? remSlice.slice(l) : "(exact match)",
          score: wordScores[candF] || 0,
        });
      }
    }

    if (reqLen <= MAX_FWD_LEN) {
      const list = fwdByPrefix[remSlice] || [];
      for (const candF of list) {
        if (candF.length > reqLen && !usedWords.has(candF)) {
          seen.add(candF);
          const excess = candF.slice(reqLen);
          rawCandidates.push({
            word: candF,
            direction: "Inward",
            length: candF.length,
            leftover: "+" + excess.length + " letters ('" + excess + "')",
            score: wordScores[candF] || 0,
          });
        }
      }
    }

    rawCandidates.sort((a, b) => b.score - a.score);
    const verified = [];
    for (const cand of rawCandidates) {
      usedWords.add(cand.word);
      const ok = hasValidCompletion(
        state.fwdWords.concat([cand.word]),
        state.patWords,
        state.sFwd + cand.word,
        state.sPat,
        state.atGap,
        usedWords
      );
      usedWords.delete(cand.word);
      if (ok) {
        verified.push(cand);
      }
    }

    return { direction: "INWARD", items: verified };
  }

  // CASE 3: delta == 0 (both streams aligned)
  const iFwd = state.fwdWords.length;
  const kPat = state.patWords.length;

  if (iFwd === currentN && kPat === M + 1) {
    return { direction: "COMPLETE", items: [] };
  }

  if (iFwd < currentN) {
    const starters = fwdByPrefix[""] || [];
    const verified = [];

    for (const candF of starters) {
      if (usedWords.has(candF)) continue;

      usedWords.add(candF);
      const ok = hasValidCompletion(
        state.fwdWords.concat([candF]),
        state.patWords,
        state.sFwd + candF,
        state.sPat,
        state.atGap,
        usedWords,
        currentN === 2 ? 6 : 4
      );
      usedWords.delete(candF);

      if (ok) {
        verified.push({
          word: candF,
          direction: "Inward",
          length: candF.length,
          leftover: "(viable starter)",
          score: wordScores[candF] || 0,
        });
      }

      if (verified.length >= 200) break;
    }

    return { direction: "INWARD", items: verified };
  }

  return { direction: "NONE", items: [] };
}

// ============================================================================
// [5] Word Selection Action
// ============================================================================

function selectWord(word, direction) {
  saveState();

  if (direction === "Inward") {
    state.fwdWords.push(word);
    state.sFwd += word;
  } else {
    const r = word.split("").reverse().join("");
    state.patWords.push(r);
    state.sPat += r;
    const M = targetW.length;
    if (state.patWords.length <= M) {
      state.atGap = true;
    }
  }

  updateUI();
  refreshCandidates();
}

// ============================================================================
// [6] UI Updates and Table Rendering
// ============================================================================

function updateUI() {
  const M = targetW.length;

  // Inward display
  document.getElementById("inwardHeader").textContent =
    `Inward Words (${state.fwdWords.length} / ${currentN})`;

  if (state.fwdWords.length === 0) {
    document.getElementById("inwardWordsDisplay").innerHTML = "<em>None yet</em>";
  } else {
    document.getElementById("inwardWordsDisplay").innerHTML =
      state.fwdWords.map((w, idx) => `<strong>${idx + 1}.</strong> ${w} (${w.length})`).join(" &nbsp;/&nbsp; ");
  }

  // Outward display: prepending backwards towards cell 1
  // patWords[0] is the word that touches cell 1 (B_M)
  // patWords[1] is the word before that (B_{M-1})...
  // So in Outward reading order (outer end towards cell 1):
  //   patWords[k-1]^R  ...  (W[M-2])  patWords[1]^R  (W[M-1])  patWords[0]^R
  document.getElementById("outwardHeader").textContent =
    `Outward Words (${state.patWords.length} / ${M + 1})`;

  if (state.patWords.length === 0) {
    document.getElementById("outwardWordsDisplay").innerHTML = "<em>None yet</em>";
  } else {
    const outwardSpans = [];
    const kPat = state.patWords.length;

    // Build from furthest out (highest index in patWords) down to cell 1 (index 0)
    for (let j = kPat - 1; j >= 0; j--) {
      // If currently at gap and we are at the outermost word, display the pending gap before it
      if (j === kPat - 1 && (state.atGap || state.sPat.length > state.sFwd.length)) {
        if (j < M) {
          const gapLetter = targetW[M - 1 - j];
          outwardSpans.push(`<span class="gap-badge">${gapLetter}</span>`);
        }
      }

      const bwdWord = state.patWords[j].split("").reverse().join("");
      outwardSpans.push(`<span class="word-chip">${bwdWord}</span> (${bwdWord.length})`);

      // Between patWords[j] and patWords[j-1] is gap W[M - 1 - (j-1)]
      if (j > 0) {
        const gapLetter = targetW[M - j];
        outwardSpans.push(`<span class="gap-badge">${gapLetter}</span>`);
      }
    }

    document.getElementById("outwardWordsDisplay").innerHTML = outwardSpans.join(" ");
  }

  // Stream visualizer
  document.getElementById("fwdStream").textContent = state.sFwd || "-";
  document.getElementById("bwdStream").textContent =
    state.sFwd ? state.sFwd.split("").reverse().join("") : "-";
}

function refreshCandidates() {
  const turnEl = document.getElementById("turnMsg");
  turnEl.textContent = "Calculating viable options...";

  setTimeout(() => {
    const result = computeCandidates();

    if (result.direction === "GAP_ERROR") {
      turnEl.innerHTML = `<span style="color:#f87171;">Gap Mismatch: forward letter does not match required gap '${result.gapChar}'. Please undo.</span>`;
    } else if (result.direction === "COMPLETE") {
      turnEl.innerHTML = `<span style="color:#4ade80;">Spiral Complete! All ${currentN} Inward and ${targetW.length + 1} Outward words matched with secret gaps '${targetW}'!</span>`;
    } else if (result.direction === "INWARD") {
      turnEl.textContent = `Pick next Inward word (${result.items.length} verified options)`;
    } else if (result.direction === "OUTWARD") {
      turnEl.textContent = `Pick next Outward word (${result.items.length} verified options)`;
    } else {
      turnEl.textContent = "No valid words found for this branch. Click Undo to try another branch.";
    }

    if (!dataTable) {
      dataTable = $("#datatables-table").DataTable({
        order: [[4, "desc"]],
        pageLength: 25,
        columns: [
          { data: "direction" },
          { data: "word" },
          { data: "length" },
          { data: "leftover" },
          { data: "score" }
        ]
      });

      $("#datatables-table tbody").on("click", "tr", function () {
        const rowData = dataTable.row(this).data();
        if (rowData) {
          selectWord(rowData.word, rowData.direction);
        }
      });
    }

    dataTable.clear();
    if (result.items && result.items.length > 0) {
      dataTable.rows.add(result.items);
    }
    dataTable.draw();
  }, 10);
}

// ============================================================================
// [7] Initialization on Page Load
// ============================================================================

$(document).ready(function () {
  initDictionary();
});
