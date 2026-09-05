/**
 * Acrostic Solver Test & Benchmark Suite
 *
 * Usage:
 *   node test.js              # Runs unit tests and all benchmarks
 *   node test.js --bench      # Runs benchmarks only
 *   node test.js --unit       # Runs unit tests only
 *   node test.js <1|2|3>      # Runs a specific benchmark case
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const assert = require('assert');

const AcrosticSolver = require('./glpk/solver.js');
let glpkModule = null;

// Helper to load wordlist
function loadWordlist() {
  const gzPath = path.join(__dirname, 'spreadthewordlist.dict.gz');
  const dictPath = path.join(__dirname, 'spreadthewordlist.dict');

  if (fs.existsSync(gzPath)) {
    const buf = fs.readFileSync(gzPath);
    return zlib.gunzipSync(buf).toString('utf-8');
  } else if (fs.existsSync(dictPath)) {
    return fs.readFileSync(dictPath, 'utf-8');
  } else {
    throw new Error('Wordlist dictionary not found.');
  }
}

// Helper to validate a solution against quote and source rules
function validateSolution(quote, source, solution, wordlistSet = null) {
  if (!Array.isArray(solution) || solution.length === 0) {
    return { valid: false, reason: 'No solution returned (empty array)' };
  }

  const sAlpha = AcrosticSolver.alphaOnly(source);
  const qAlpha = AcrosticSolver.alphaOnly(quote);

  if (solution.length !== sAlpha.length) {
    return {
      valid: false,
      reason: `Expected ${sAlpha.length} words, got ${solution.length}`
    };
  }

  // Check initials match source in order
  for (let i = 0; i < sAlpha.length; i++) {
    const word = solution[i].toLowerCase();
    if (word[0] !== sAlpha[i]) {
      return {
        valid: false,
        reason: `Word ${i + 1} (${word}) initial does not match expected '${sAlpha[i]}'`
      };
    }
  }

  // Check letter counts match quote exactly
  const solText = AcrosticSolver.alphaOnly(solution.join(''));
  const qCounts = AcrosticSolver.getLetterCounts(qAlpha);
  const sCounts = AcrosticSolver.getLetterCounts(solText);

  const letters = new Set([...Object.keys(qCounts), ...Object.keys(sCounts)]);
  for (const ch of letters) {
    const qC = qCounts[ch] || 0;
    const sC = sCounts[ch] || 0;
    if (qC !== sC) {
      return {
        valid: false,
        reason: `Letter count mismatch for '${ch}': quote has ${qC}, solution has ${sC}`
      };
    }
  }

  // Check dictionary inclusion if wordlist set provided
  if (wordlistSet) {
    for (const w of solution) {
      if (!wordlistSet.has(w.toLowerCase())) {
        return {
          valid: false,
          reason: `Word '${w}' is not in the dictionary`
        };
      }
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Unit Tests
// ---------------------------------------------------------------------------
function runUnitTests(wordlistText) {
  console.log('\n=== Running Unit Tests ===');

  // 1. alphaOnly
  assert.strictEqual(AcrosticSolver.alphaOnly('Hello, World! 123'), 'helloworld');
  console.log('✓ alphaOnly');

  // 2. getLetterCounts
  const counts = AcrosticSolver.getLetterCounts('aabcc');
  assert.deepStrictEqual(counts, { a: 2, b: 1, c: 2 });
  console.log('✓ getLetterCounts');

  // 3. removeString
  assert.strictEqual(AcrosticSolver.removeString('abc', 'aabbccdd'), 'abcdd');
  assert.strictEqual(AcrosticSolver.removeString('cat', 'catalog'), 'alog');
  console.log('✓ removeString');

  // 4. isSubstring
  assert.strictEqual(AcrosticSolver.isSubstring('dog', 'gooddog'), true);
  assert.strictEqual(AcrosticSolver.isSubstring('cat', 'car'), false);
  console.log('✓ isSubstring');

  // 5. Letter fit score
  const qCtr = AcrosticSolver.getLetterCounts('banana');
  const qFreq = {};
  for (const ch in qCtr) qFreq[ch] = qCtr[ch] / 6;
  const normQ = Math.sqrt(Object.values(qFreq).reduce((s, v) => s + v * v, 0));
  const fitScore = AcrosticSolver.letterFitScore('abana', qFreq, normQ);
  assert.ok(typeof fitScore === 'number' && fitScore > 0);
  console.log('✓ letterFitScore');

  // 6. Remainder pool filtering (quote - source)
  // If quote has only 1 'z' and source starts with 'Z', remainder cannot contain 'z'
  const mockWordlist = 'zebra;100\naztec;100\napple;100\n';
  const candidates = AcrosticSolver.filterCandidates(
    mockWordlist,
    'z',         // source: 'z'
    'za',        // quote: 'z' + 'a'
    1, 10,
    50,
    new Set(),
    null
  );

  // 6. Remainder pool filtering (quote - source)
  // 'aztec' needs 'z' in remainder, but 'z' was consumed by source initials
  assert.ok(!candidates.includes('aztec'), 'Words requiring exhausted source letters in remainder must be pruned');
  console.log('✓ quote - source remainder pool pruning');

  // 7. pruneCandidatesByDensity (deterministic size and reproducibility)
  const sampleList = [
    { word: 'personality', score: 50 },
    { word: 'pointspread', score: 50 },
    { word: 'precautions', score: 50 },
    { word: 'pigglywiggly', score: 50 },
    { word: 'pickwickclub', score: 50 },
    { word: 'playboybunny', score: 50 }
  ];
  const pruned1 = AcrosticSolver.pruneCandidatesByDensity(sampleList, 3);
  const pruned2 = AcrosticSolver.pruneCandidatesByDensity(sampleList, 3);
  assert.strictEqual(pruned1.length, 3);
  assert.deepStrictEqual(pruned1, pruned2, 'Pruning must be completely deterministic across runs');
  console.log('✓ pruneCandidatesByDensity (deterministic density pruning)');

  console.log('All unit tests passed!\n');
}

// ---------------------------------------------------------------------------
// Benchmark Test Cases
// ---------------------------------------------------------------------------
const BENCHMARK_CASES = [
  {
    id: 1,
    name: 'Megan Amram',
    source: 'megan amram',
    quote: "when singers at concerts hold out the mic for the audience to sing it's like what am i, your maid",
    options: { distance: 1, minScore: 50 }
  },
  {
    id: 2,
    name: 'Mahmoud Darwish',
    source: 'Mahmoud Darwish',
    quote: 'Letters lie before you, so release them from their neutrality and play with them like a conqueror in a delirious universe. Letters are restless, hungry for an image, and the image is thirsty for a meaning.',
    options: { distance: 1, minScore: 50 }
  },
  {
    id: 3,
    name: 'Ted Turner, Giving Pledge',
    source: 'Ted Turner, Giving Pledge',
    quote: 'Looking back, if I had to live my life over, there are things I would do differently, but the one thing I would not change is my charitable giving. I’m particularly thankful for my father’s advice to set goals so high that they can’t possibly be achieved during a lifetime and to give help where help is needed most.',
    options: { distance: 1, minScore: 50 }
  }
];

async function runBenchmarks(wordlistText, selectedCaseId = null) {
  if (!glpkModule) {
    const GLPK = (await import('./glpk/glpk.js')).default;
    glpkModule = await GLPK();
  }

  const casesToRun = selectedCaseId
    ? BENCHMARK_CASES.filter(c => c.id === parseInt(selectedCaseId, 10))
    : BENCHMARK_CASES;

  if (casesToRun.length === 0) {
    console.error(`Unknown case ID: ${selectedCaseId}. Choose 1, 2, or 3.`);
    return;
  }

  console.log('=== Running Solver Benchmarks ===\n');

  const summary = [];

  for (const tc of casesToRun) {
    console.log(`----------------------------------------------------------------------`);
    console.log(`[Case ${tc.id}] ${tc.name}`);
    const qLen = AcrosticSolver.alphaOnly(tc.quote).length;
    const sLen = AcrosticSolver.alphaOnly(tc.source).length;
    console.log(`Quote: "${tc.quote.slice(0, 60)}..." (${qLen} letters)`);
    console.log(`Source: "${tc.source}" (${sLen} words target, mean length: ${(qLen / sLen).toFixed(2)})`);
    console.log(`Options: distance=${tc.options.distance}, minScore=${tc.options.minScore}`);

    // 1. Measure Candidate Filtering
    const t0Filter = Date.now();
    const sAlpha = AcrosticSolver.alphaOnly(tc.source);
    const qAlpha = AcrosticSolver.alphaOnly(tc.quote);
    const meanLen = qAlpha.length / sAlpha.length;
    const minLen = Math.max(1, Math.ceil(meanLen - tc.options.distance));
    const maxLen = Math.max(minLen, Math.floor(meanLen + tc.options.distance));

    const candidates = AcrosticSolver.filterCandidates(
      wordlistText,
      sAlpha,
      qAlpha,
      minLen,
      maxLen,
      tc.options.minScore,
      new Set(),
      tc.options.maxCandidatesPerLetter || null
    );
    const filterTimeMs = Date.now() - t0Filter;

    console.log(`Candidates filtered: ${candidates.length} words in ${filterTimeMs}ms (lengths ${minLen}-${maxLen})`);

    // 2. Measure Full Solve
    const t0Solve = Date.now();
    const solution = AcrosticSolver.createAcrostic(
      tc.quote,
      tc.source,
      {
        wordlistText,
        minScore: tc.options.minScore,
        lenDistance: tc.options.distance,
        maxCandidatesPerLetter: tc.options.maxCandidatesPerLetter || null
      },
      glpkModule
    );
    const totalSolveTimeMs = Date.now() - t0Solve;

    // 3. Validate
    const val = validateSolution(tc.quote, tc.source, solution);
    const statusText = val.valid ? 'VALID ✓' : `INVALID ✗ (${val.reason})`;

    console.log(`Solve time: ${totalSolveTimeMs}ms | Status: ${statusText}`);

    if (solution.length > 0) {
      console.log(`Solution (${solution.length} words):`);
      console.log(`  ${solution.map(w => w.toUpperCase()).join(' ')}`);
    } else {
      console.log(`  (No solution found)`);
    }

    summary.push({
      id: tc.id,
      name: tc.name,
      candidates: candidates.length,
      filterTimeMs,
      totalTimeMs: totalSolveTimeMs,
      valid: val.valid,
      statusText
    });
    console.log();
  }

  console.log('======================================================================');
  console.log('BENCHMARK SUMMARY');
  console.log('======================================================================');
  console.log(
    'Case'.padEnd(6) +
    'Name'.padEnd(30) +
    'Candidates'.padEnd(14) +
    'Filter Time'.padEnd(14) +
    'Total Time'.padEnd(14) +
    'Status'
  );
  console.log('-'.repeat(85));
  for (const s of summary) {
    console.log(
      String(s.id).padEnd(6) +
      s.name.padEnd(30) +
      String(s.candidates).padEnd(14) +
      `${s.filterTimeMs}ms`.padEnd(14) +
      `${s.totalTimeMs}ms`.padEnd(14) +
      s.statusText
    );
  }
  console.log('-'.repeat(85));
}

// ---------------------------------------------------------------------------
// Main CLI Entry
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const benchOnly = args.includes('--bench');
  const unitOnly = args.includes('--unit');
  const caseArg = args.find(a => /^[123]$/.test(a));

  try {
    console.log('Loading wordlist...');
    const t0 = Date.now();
    const wordlistText = loadWordlist();
    console.log(`Wordlist loaded in ${Date.now() - t0}ms`);

    if (!benchOnly && !caseArg) {
      runUnitTests(wordlistText);
    }

    if (!unitOnly) {
      await runBenchmarks(wordlistText, caseArg);
    }
  } catch (err) {
    console.error('Error running tests:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateSolution, BENCHMARK_CASES };
