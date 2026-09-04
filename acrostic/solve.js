#!/usr/bin/env node

/**
 * Acrostic Solver CLI in Node.js using HiGHS WebAssembly
 *
 * Usage:
 *   node solve.js -q "Quote text here" -s "Author Name" [-d 1] [-m 50]
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const Module = require(path.join(__dirname, 'highs', 'highs.js'));
const AcrosticSolver = require(path.join(__dirname, 'highs', 'solver.js'));

function printHelp() {
  console.log(`
Acrostic Machine - Node.js CLI Solver

Usage:
  node solve.js -q <quote> -s <source> [options]

Options:
  -q, --quote       Quote text (required)
  -s, --source      Source initials / author (required)
  -d, --distance    Maximum length deviation from mean (default: 3)
  -m, --minscore    Minimum dictionary word score (default: 50)
  -x, --excluded    Comma-separated words to exclude
  -i, --included    Comma-separated words to include
  -w, --wordlist    Custom wordlist file (.txt, .dict, or .dict.gz)
  -h, --help        Show this help message

Example:
  node solve.js -q "The quick brown fox jumps over the lazy dog" -s "QuickDog" -d 3
`);
}

function parseCommandLineArgs(argv) {
  const opts = {
    quote: '',
    source: '',
    distance: 3,
    minScore: 50,
    excluded: [],
    included: [],
    wordlist: ''
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const val = argv[i + 1];

    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '-q' || arg === '--quote') {
      opts.quote = val;
      i++;
    } else if (arg === '-s' || arg === '--source') {
      opts.source = val;
      i++;
    } else if (arg === '-d' || arg === '--distance') {
      opts.distance = parseInt(val, 10);
      i++;
    } else if (arg === '-m' || arg === '--minscore') {
      opts.minScore = parseInt(val, 10);
      i++;
    } else if (arg === '-x' || arg === '--excluded') {
      opts.excluded = (val || '').split(',').map(s => s.trim()).filter(Boolean);
      i++;
    } else if (arg === '-i' || arg === '--included') {
      opts.included = (val || '').split(',').map(s => s.trim()).filter(Boolean);
      i++;
    } else if (arg === '-w' || arg === '--wordlist') {
      opts.wordlist = val;
      i++;
    }
  }

  return opts;
}

function loadWordlist(customPath) {
  let filePath = customPath;

  if (!filePath) {
    const localGz = path.join(__dirname, 'spreadthewordlist.dict.gz');
    const localDict = path.join(__dirname, 'spreadthewordlist.dict');
    const sharedDict = path.join(__dirname, '..', 'word_lists', 'spreadthewordlist.dict');

    if (fs.existsSync(localGz)) {
      filePath = localGz;
    } else if (fs.existsSync(localDict)) {
      filePath = localDict;
    } else if (fs.existsSync(sharedDict)) {
      filePath = sharedDict;
    } else {
      throw new Error('Default wordlist not found. Please specify via -w <path>.');
    }
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Wordlist file not found: ${filePath}`);
  }

  const buf = fs.readFileSync(filePath);
  if (filePath.endsWith('.gz') || (buf[0] === 0x1f && buf[1] === 0x8b)) {
    return zlib.gunzipSync(buf).toString('utf-8');
  }
  return buf.toString('utf-8');
}

async function solveAcrostic(quote, source, options = {}) {
  const highs = await Module({
    locateFile: (file) => path.join(__dirname, 'highs', file)
  });

  const wordlistText = options.wordlistText || loadWordlist(options.wordlistPath);

  return AcrosticSolver.createAcrostic(quote, source, {
    wordlistText: wordlistText,
    excluded: options.excluded || [],
    included: options.included || [],
    minScore: options.minScore !== undefined ? options.minScore : 50,
    lenDistance: options.distance !== undefined ? options.distance : 3,
    maxCandidatesPerLetter: options.maxCandidatesPerLetter || null
  }, highs);
}

async function main() {
  const args = parseCommandLineArgs(process.argv.slice(2));

  if (args.help || (!args.quote && !args.source)) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  if (!args.quote || !args.source) {
    console.error('Error: Both --quote (-q) and --source (-s) are required.');
    process.exit(1);
  }

  try {
    const startTime = Date.now();
    const solution = await solveAcrostic(args.quote, args.source, {
      distance: args.distance,
      minScore: args.minScore,
      excluded: args.excluded,
      included: args.included,
      wordlistPath: args.wordlist
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!solution || solution.length === 0) {
      console.log(`No solutions found. (${elapsed}s)`);
      process.exit(0);
    }

    for (const word of solution) {
      console.log(word.toUpperCase());
    }
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { solveAcrostic };
