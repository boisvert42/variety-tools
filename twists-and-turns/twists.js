// All 16 valid spiral paths within a 3x3 grid (represented as 0-8 indices)
const SPIRAL_PATHS = [
  // Corner-to-Center Inward (8 paths)
  { name: "Corner 0 CW", type: "inward", path: [0, 1, 2, 5, 8, 7, 6, 3, 4] },
  { name: "Corner 0 CCW", type: "inward", path: [0, 3, 6, 7, 8, 5, 2, 1, 4] },
  { name: "Corner 2 CW", type: "inward", path: [2, 5, 8, 7, 6, 3, 0, 1, 4] },
  { name: "Corner 2 CCW", type: "inward", path: [2, 1, 0, 3, 6, 7, 8, 5, 4] },
  { name: "Corner 8 CW", type: "inward", path: [8, 7, 6, 3, 0, 1, 2, 5, 4] },
  { name: "Corner 8 CCW", type: "inward", path: [8, 5, 2, 1, 0, 3, 6, 7, 4] },
  { name: "Corner 6 CW", type: "inward", path: [6, 3, 0, 1, 2, 5, 8, 7, 4] },
  { name: "Corner 6 CCW", type: "inward", path: [6, 7, 8, 5, 2, 1, 0, 3, 4] },

  // Center-to-Perimeter Outward (8 paths)
  { name: "Center to N CW", type: "outward", path: [4, 1, 2, 5, 8, 7, 6, 3, 0] },
  { name: "Center to N CCW", type: "outward", path: [4, 1, 0, 3, 6, 7, 8, 5, 2] },
  { name: "Center to E CW", type: "outward", path: [4, 5, 8, 7, 6, 3, 0, 1, 2] },
  { name: "Center to E CCW", type: "outward", path: [4, 5, 2, 1, 0, 3, 6, 7, 8] },
  { name: "Center to S CW", type: "outward", path: [4, 7, 6, 3, 0, 1, 2, 5, 8] },
  { name: "Center to S CCW", type: "outward", path: [4, 7, 8, 5, 2, 1, 0, 3, 6] },
  { name: "Center to W CW", type: "outward", path: [4, 3, 0, 1, 2, 5, 8, 7, 6] },
  { name: "Center to W CCW", type: "outward", path: [4, 3, 6, 7, 8, 5, 2, 1, 0] }
];

// Dictionary data with match counts
let wordsSet = new Set();
let prefixMap = new Map();
let suffixMap = new Map();
let words9 = [];
let lastLoadedText = "";

// Initialize UI
updateGridPreview();

// Auto-load default word list on startup
window.addEventListener("DOMContentLoaded", () => {
  const spinner = document.getElementById("loading-spinner");
  const status = document.getElementById("loading-status");
  const minScore = parseInt(document.getElementById("min-score").value) || 0;

  spinner.style.display = "inline-block";
  status.innerText = "Attempting to load default wordlist...";

  fetch("../word_lists/spreadthewordlist.dict")
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch default wordlist: ${response.statusText}`);
      }
      return response.text();
    })
    .then(text => {
      parseAndIndexWordlist(text, minScore);
    })
    .catch(err => {
      console.warn("Default wordlist auto-load failed:", err);
      spinner.style.display = "none";
      status.innerText = "Please select a dictionary file manually.";
    });
});

function updateGridPreview() {
  const patternInput = document.getElementById("twist-pattern").value.replace(/\s+/g, "");
  const previewContainer = document.getElementById("grid-preview");
  previewContainer.innerHTML = "";

  const pattern = patternInput.padEnd(9, "?").substring(0, 9);

  // Render cells directly row-by-row (left-to-right, top-to-bottom)
  for (let idx = 0; idx < 9; idx++) {
    const char = pattern[idx];
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    if (char !== "?" && char !== ".") {
      if (char === char.toLowerCase()) {
        cell.className += " constant";
      } else {
        cell.className += " variable";
      }
    }
    cell.innerText = char;
    previewContainer.appendChild(cell);
  }
}

function parseAndIndexWordlist(text, minScore) {
  lastLoadedText = text;
  const spinner = document.getElementById("loading-spinner");
  const status = document.getElementById("loading-status");

  spinner.style.display = "inline-block";
  status.innerText = "Indexing dictionary...";

  setTimeout(() => {
    const lines = text.split(/\r?\n/);

    wordsSet.clear();
    prefixMap.clear();
    suffixMap.clear();
    words9 = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      let word = "";
      let score = 999;

      if (line.includes(";")) {
        const parts = line.split(";");
        word = parts[0].toUpperCase();
        score = parseInt(parts[1]) || 0;
      } else {
        word = line.toUpperCase();
      }

      if (/[\d&]/.test(word)) {
        continue;
      }
      word = word.replace(/[^A-Z]/g, "");

      if (score >= minScore && /^[A-Z]+$/.test(word)) {
        wordsSet.add(word);
        if (word.length === 9) {
          words9.push(word);
        }
        // Populate prefix and suffix count maps
        for (let len = 1; len <= word.length; len++) {
          const pref = word.substring(0, len);
          const suff = word.substring(word.length - len);

          prefixMap.set(pref, (prefixMap.get(pref) || 0) + 1);
          suffixMap.set(suff, (suffixMap.get(suff) || 0) + 1);
        }
      }
    }

    spinner.style.display = "none";
    status.innerText = `Loaded ${wordsSet.size.toLocaleString()} words (${words9.length.toLocaleString()} of length 9).`;
  }, 50);
}

function loadOrReloadWordlist() {
  const fileInput = document.getElementById("wordlist-file");
  const minScore = parseInt(document.getElementById("min-score").value) || 0;

  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      parseAndIndexWordlist(e.target.result, minScore);
    };
    reader.readAsText(file);
  } else {
    if (!lastLoadedText) {
      alert("No word list loaded yet!");
      return;
    }
    parseAndIndexWordlist(lastLoadedText, minScore);
  }
}

// Parse the 9-char template in grid cell order (left-to-right, top-to-bottom)
function parsePattern(patternStr) {
  const pat = patternStr.replace(/\s+/g, "").substring(0, 9);
  if (pat.length !== 9) {
    alert("Pattern must be exactly 9 characters long!");
    return null;
  }

  const variables = {};
  const constants = [];

  for (let cellIdx = 0; cellIdx < 9; cellIdx++) {
    const char = pat[cellIdx];
    if (char === char.toLowerCase() && char !== "?" && char !== ".") {
      constants.push({ cell: cellIdx, char: char.toUpperCase() });
    } else if (char === char.toUpperCase() && char !== "?" && char !== ".") {
      if (!variables[char]) {
        variables[char] = [];
      }
      variables[char].push(cellIdx);
    }
  }

  return { pattern: pat, variables, constants };
}

// Evaluate constraints against variable bindings, returning list of resolved info or null if failed
function evaluateConstraints(bindings, constraints) {
  const resolvedList = [];

  for (const rawConstraint of constraints) {
    let constraint = rawConstraint.trim();
    if (!constraint) continue;

    let isPrefix = false;
    let isSuffix = false;

    if (constraint.startsWith("*")) {
      isSuffix = true;
      constraint = constraint.substring(1);
    }
    if (constraint.endsWith("*")) {
      isPrefix = isSuffix; // if both, it's contains
      isPrefix = !isSuffix; // if only ends with *, it's prefix
      constraint = constraint.slice(0, -1);
    }

    // Check again for contains
    const isContains = rawConstraint.trim().startsWith("*") && rawConstraint.trim().endsWith("*");

    // Replace variables in the constraint
    let resolved = "";
    let i = 0;

    while (i < constraint.length) {
      if (constraint[i] === "~" && i + 1 < constraint.length) {
        const varName = constraint[i + 1];
        if (varName >= 'A' && varName <= 'Z' && bindings[varName] !== undefined) {
          resolved += bindings[varName].split("").reverse().join("");
          i += 2;
        } else {
          resolved += "~";
          i += 1;
        }
      } else {
        const char = constraint[i];
        if (char >= 'A' && char <= 'Z' && bindings[char] !== undefined) {
          resolved += bindings[char];
        } else {
          resolved += char; // Keep literal (e.g. lowercase, numbers, etc.)
        }
        i += 1;
      }
    }

    // Verify matches and count them using uppercase for lookups
    const lookupVal = resolved.toUpperCase();
    let matchCount = 0;
    let displayStr = "";

    if (isContains) {
      for (const w of wordsSet) {
        if (w.includes(lookupVal)) {
          matchCount++;
        }
      }
      displayStr = `*${resolved}*`;
    } else if (isPrefix) {
      matchCount = prefixMap.get(lookupVal) || 0;
      displayStr = `${resolved}*`;
    } else if (isSuffix) {
      matchCount = suffixMap.get(lookupVal) || 0;
      displayStr = `*${resolved}`;
    } else {
      matchCount = wordsSet.has(lookupVal) ? 1 : 0;
      displayStr = resolved;
    }

    if (matchCount === 0) {
      return null; // Constraint violated
    }

    resolvedList.push({
      raw: rawConstraint,
      resolvedDisplay: displayStr,
      count: matchCount
    });
  }

  return resolvedList;
}

function performSearch() {
  const searchBtn = document.getElementById("search-btn");

  if (wordsSet.size === 0) {
    alert("Please load a dictionary first.");
    return;
  }

  const patternInput = document.getElementById("twist-pattern").value;
  const parsed = parsePattern(patternInput);
  if (!parsed) return;

  const rawConstraints = document.getElementById("turn-constraints").value.split("\n");
  const activeConstraints = rawConstraints.filter(c => c.trim().length > 0);

  // Disable button and show searching state
  searchBtn.disabled = true;
  searchBtn.innerText = "Searching...";

  const matches = [];

  setTimeout(() => {
    for (const word of words9) {
      for (let pIdx = 0; pIdx < SPIRAL_PATHS.length; pIdx++) {
        const P_obj = SPIRAL_PATHS[pIdx];
        const P = P_obj.path;

        // 1. Build grid G representing the 3x3 block cell values for this spiral path P
        const G = new Array(9);
        for (let c = 0; c < 9; c++) {
          G[c] = word[P.indexOf(c)];
        }

        // 2. Validate against constants in layout template
        let valid = true;
        for (const c of parsed.constants) {
          if (G[c.cell] !== c.char) {
            valid = false;
            break;
          }
        }
        if (!valid) continue;

        // 3. Extract variable bindings directly from the grid cells (in grid order)
        const bindings = {};
        for (const [varName, cells] of Object.entries(parsed.variables)) {
          bindings[varName] = cells.map(c => G[c]).join("");
        }

        // 4. Validate and count turn constraints
        const resolvedConstraints = evaluateConstraints(bindings, activeConstraints);
        if (resolvedConstraints) {
          // Extract the counts to determine the bottleneck sorting order
          const sortedCounts = resolvedConstraints.map(rc => rc.count).sort((a, b) => a - b);
          matches.push({
            word: word,
            pathName: P_obj.name,
            pathType: P_obj.type,
            gridSeq: G.join(""),
            bindings: bindings,
            resolvedConstraints: resolvedConstraints,
            sortedCounts: sortedCounts
          });
        }
      }
    }

    // Sort: largest bottleneck first (lexicographically over sorted constraints counts descending)
    matches.sort((a, b) => {
      const len = Math.min(a.sortedCounts.length, b.sortedCounts.length);
      for (let i = 0; i < len; i++) {
        if (a.sortedCounts[i] !== b.sortedCounts[i]) {
          return b.sortedCounts[i] - a.sortedCounts[i]; // Descending
        }
      }
      return b.sortedCounts.length - a.sortedCounts.length;
    });

    renderResults(matches);
  }, 50);
}

function renderResults(matches) {
  const searchBtn = document.getElementById("search-btn");

  // Re-enable search button
  searchBtn.disabled = false;
  searchBtn.innerText = "Search Candidates";

  const table = $('#results-table').DataTable();
  table.clear();

  const rowsData = [];
  for (const m of matches) {
    const badgeClass = m.pathType === "inward" ? "badge-inward" : "badge-outward";
    const pathCell = `<span class="badge ${badgeClass}">${m.pathType.toUpperCase()}</span> <span class="path-direction">${m.pathName}</span>`;

    let bindingsStr = "";
    for (const [k, v] of Object.entries(m.bindings)) {
      bindingsStr += `<strong>${k}</strong>: ${v} &nbsp;&nbsp;`;
    }

    let constraintsHtml = "";
    for (const rc of m.resolvedConstraints) {
      constraintsHtml += `<span class="constraint-pill" title="Original: ${rc.raw}">
        ${rc.resolvedDisplay} (${rc.count.toLocaleString()})
      </span> `;
    }

    rowsData.push([
      `<strong>${m.word}</strong>`,
      pathCell,
      `<code>${m.gridSeq}</code>`,
      bindingsStr,
      constraintsHtml
    ]);
  }

  table.rows.add(rowsData).draw();
}
