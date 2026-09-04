# Acrostic Machine

Tools for acrostic puzzle creation.

## Web Interface

Open `index.html` in any modern browser (served via an HTTP server or GitHub Pages). 

The web solver runs entirely client-side using a Web Worker and the [HiGHS](https://highs.dev/) mixed-integer linear programming (MIP) solver compiled to WebAssembly.

## Node.js CLI Solver

You can run the solver directly from the terminal with Node (no extra packages or compilation required):

```bash
node solve.js -q "Quote text here" -s "Author Name" [options]
```

### Options:
- `-q, --quote`: The quote text (required)
- `-s, --source`: The source initials / author (required)
- `-d, --distance`: Maximum length deviation from mean length (default: `3`)
- `-m, --minscore`: Minimum word score (default: `50`)
- `-x, --excluded`: Comma-separated words to exclude
- `-i, --included`: Comma-separated words to include
- `-w, --wordlist`: Path to custom word list (`.txt`, `.dict`, or `.dict.gz`)

### Programmatic Usage in Node:
```javascript
const { solveAcrostic } = require('./solve.js');

async function run() {
  const words = await solveAcrostic(
    "The quick brown fox jumps over the lazy dog",
    "QuickDog",
    { distance: 1, minScore: 50 }
  );
  console.log(words);
}

run();
```

## Python CLI Solver

Requirements: swiglpk (`pip install swiglpk`)

Usage: 
```bash
python acrostic_glp.py -q "Quote text here" -s "Author Name"
```

You can also use `acrostic_ide.py` from within an editor, or edit the file and run it from the command line.

## Credits & Licenses

* **HiGHS WebAssembly Solver**: Included in `highs/` via [highs-js](https://github.com/lovasoa/highs-js), compiling [HiGHS](https://highs.dev/). Both are licensed under the [MIT License](highs/LICENSE).
* **Spread The Wordlist**: Wordlist from [Spread The Wordlist](https://www.spreadthewordlist.com/), licensed under [Creative Commons BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
* **fflate**: Fast, lightweight in-browser decompression library (https://github.com/101arrowz/fflate), licensed under the MIT License.
