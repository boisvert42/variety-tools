# Acrostic Machine

Tools for acrostic puzzle creation.

## Web Interface

Open `index.html` in any modern browser (served via an HTTP server or GitHub Pages). 

The web solver runs entirely client-side using a Web Worker and the [HiGHS](https://highs.dev/) mixed-integer linear programming (MIP) solver compiled to WebAssembly.

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
