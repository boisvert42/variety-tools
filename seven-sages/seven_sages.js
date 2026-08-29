/**
 * Seven Sages Construction (JS Port)
 * (c) 2026, Crossword Nexus / Antigravity
 * MIT License
 */

let WORDS = [];
const WORD_SCORES = new Map();

/**
 * Initializes the wordlist dictionary and parses words with their associated scores.
 * Filters out words that are not exactly 7 letters or are scored under 50.
 * @param {string} wordListText - Raw dictionary content with format "word;score" separated by newlines.
 */
export function initWords(wordListText) {
    const lines = wordListText.split('\n');
    const wordsSet = new Set();
    WORD_SCORES.clear();
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(';');
        if (parts.length === 2) {
            const word = parts[0].toLowerCase();
            const score = parseInt(parts[1], 10);
            if (word.length === 7 && score >= 50) {
                wordsSet.add(word);
                WORD_SCORES.set(word, score);
            }
        }
    }
    WORDS = Array.from(wordsSet);
}

/**
 * Returns the dictionary score of a given word, or 0 if it is not found.
 * @param {string} word - The word to look up.
 * @returns {number} Score of the word.
 */
export function getWordScore(word) {
    return WORD_SCORES.get(word.toLowerCase()) || 0;
}

/**
 * Filters a string to only include lowercase alphabetic characters.
 * @param {string} s - Input string.
 * @returns {string} Lowercase alphabetic-only string.
 */
function alphaOnly(s) {
    return s.toLowerCase().replace(/[^a-z]+/g, '');
}

/**
 * Returns the 7 rotations of a word.
 * @param {string} input - The 7-letter word/pattern.
 * @param {boolean} [backward=false] - Whether to reverse the string before rotating.
 * @returns {Set<string>} A Set of the 7 rotated patterns.
 */
function bloomPatterns1(input, backward = false) {
    let str = backward ? input.split('').reverse().join('') : input;
    const patterns = new Set();
    for (let i = 0; i < 7; i++) {
        const pat = str.slice(i) + str.slice(0, i);
        patterns.add(pat);
    }
    return patterns;
}

/**
 * Returns all 14 rotations (both clockwise and counter-clockwise) of a pattern.
 * @param {string} input - The pattern/word.
 * @returns {Set<string>} A Set of all 14 rotated patterns.
 */
function bloomPatterns(input) {
    const p1 = bloomPatterns1(input, false);
    const p2 = bloomPatterns1(input, true);
    return new Set([...p1, ...p2]);
}

/**
 * Checks if a 7-letter word matches a 7-letter pattern (where '.' matches any character).
 * Both parameters must be pre-lowercased.
 * @param {string} word - The 7-letter lowercase word.
 * @param {string} pattern - The 7-letter lowercase pattern.
 * @returns {boolean} True if the word fits the pattern.
 */
function matchesPattern(word, pattern) {
    for (let i = 0; i < 7; i++) {
        const pChar = pattern[i];
        if (pChar !== '.' && pChar !== word[i]) {
            return false;
        }
    }
    return true;
}

/**
 * Finds all dictionary words matching any rotation of the given pattern.
 * @param {string} input - The pattern/word to match against.
 * @returns {Set<string>} Set of matching lowercase words.
 */
function bloomMatches(input) {
    const output = new Set();
    const patterns = Array.from(bloomPatterns(input.toLowerCase()));
    for (const w of WORDS) {
        for (let i = 0; i < patterns.length; i++) {
            if (matchesPattern(w, patterns[i])) {
                output.add(w);
                break;
            }
        }
    }
    return output;
}

/**
 * Determines which rotation of a word fits the pattern, and in what direction.
 * @param {string} word - The word to fit.
 * @param {string} pattern - The target pattern.
 * @returns {[string|null, string]} An array containing the matching rotation (or null) and direction ('+' for clockwise, '-' for counter-clockwise, or '').
 */
function wordToBloom(word, pattern) {
    const lowerWord = word.toLowerCase();
    const lowerPattern = pattern.toLowerCase();
    for (const b of bloomPatterns1(lowerWord, false)) {
        if (matchesPattern(b, lowerPattern)) {
            return [b, '+'];
        }
    }
    for (const b of bloomPatterns1(lowerWord, true)) {
        if (matchesPattern(b, lowerPattern)) {
            return [b, '-'];
        }
    }
    return [null, ''];
}

/**
 * Python-style modulo function that handles negative numbers correctly.
 * @param {number} n - Dividend.
 * @param {number} m - Divisor.
 * @returns {number} The modulo result.
 */
function mod(n, m) {
    return ((n % m) + m) % m;
}

/**
 * Solver class representing the Seven Sages circular grid puzzle.
 * Manages the rows of characters, tracks entries, and searches for valid fits.
 */
export class SevenSages {
    /**
     * Creates a new Seven Sages puzzle session with a given quote.
     * @param {string} quote - The 48-character quote that fills the outermost ring.
     */
    constructor(quote) {
        this.quote = quote;
        this.rows = [
            Array(48).fill('.'),
            Array(24).fill('.'),
            Array(24).fill('.'),
            Array(24).fill('.'),
            Array(12).fill('.'),
            Array(12).fill('.'),
            Array(12).fill('.')
        ];
        const cleanedQuote = alphaOnly(quote);
        if (cleanedQuote.length !== 48) {
            throw new Error(`Quote must be exactly 48 alpha characters. Got ${cleanedQuote.length}`);
        }
        this.rows[0] = cleanedQuote.split('');
        this.words = [];
        this.readable_words = [];
        this.directions = Array(36).fill('');
        this._update_words();
        this.readable_words = [...this.words];
    }

    /**
     * Resets the board and state back to the beginning, or optionally up to a specific word index.
     * @param {number|null} [index=null] - Index to restore state up to.
     */
    reset(index = null) {
        const words = [...this.readable_words];
        const quote = this.quote;
        
        // Re-initialize state
        this.rows = [
            Array(48).fill('.'),
            Array(24).fill('.'),
            Array(24).fill('.'),
            Array(24).fill('.'),
            Array(12).fill('.'),
            Array(12).fill('.'),
            Array(12).fill('.')
        ];
        const cleanedQuote = alphaOnly(quote);
        this.rows[0] = cleanedQuote.split('');
        this.words = [];
        this.readable_words = [];
        this.directions = Array(36).fill('');
        this._update_words();
        this.readable_words = [...this.words];

        if (index !== null) {
            for (let i = 0; i <= index; i++) {
                this.set_word(words[i], i);
            }
        }
    }

    /**
     * Removes the word at a given index, reconstructing the grid state with the remaining words.
     * @param {number} index - Index of the word to remove.
     */
    remove_word_at(index) {
        const words = [...this.readable_words];
        this.reset(null);
        for (let i = 0; i < words.length; i++) {
            if (i !== index && /^[a-z]+$/i.test(words[i])) {
                this.set_word(words[i], i);
            }
        }
    }

    /**
     * Finds the index of the first word slot that has not yet been filled.
     * @returns {number|null} Index of the unfilled word slot, or null if complete.
     */
    next_unfilled_word_index() {
        for (let i = 0; i < this.words.length; i++) {
            if (!/^[a-z]+$/i.test(this.words[i])) {
                return i;
            }
        }
        return null;
    }

    /**
     * Computes the row and column coordinates in the grid mapping to the 7 letters of the word at index jx.
     * @private
     * @param {number} jx - Word index.
     * @returns {Array<[number, number]>} Array of coordinate pairs [rowIndex, columnIndex].
     */
    _word_indices(jx) {
        const ix = jx + 1;
        if (ix <= 24) {
            return [
                [0, 2 * (ix - 1)],
                [0, (ix - 1) * 2 + 1],
                [1, ix - 1],
                [2, ix - 1],
                [3, ix - 1],
                [2, mod(ix - 2, 24)],
                [1, mod(ix - 2, 24)]
            ];
        } else {
            return [
                [3, mod((ix - 25) * 2, 24)],
                [4, ix - 25],
                [5, ix - 25],
                [6, ix - 25],
                [5, mod(ix - 26, 12)],
                [4, mod(ix - 26, 12)],
                [3, mod((ix - 26) * 2, 24) + 1]
            ];
        }
    }

    /**
     * Reconstructs the letters of a word at index jx from the current grid characters.
     * @private
     * @param {number} jx - Word index.
     * @returns {string} The 7-letter word pattern formed by the grid cells.
     */
    _word_at(jx) {
        let ret = '';
        const indices = this._word_indices(jx);
        for (const [row, ix2] of indices) {
            ret += this.rows[row][ix2];
        }
        return ret;
    }

    /**
     * Re-reads all 36 word slots from the grid characters and updates `this.words`.
     * @private
     */
    _update_words() {
        this.words = [];
        for (let i = 0; i < 36; i++) {
            this.words.push(this._word_at(i));
        }
    }

    /**
     * Places a word into the grid at the specified index, mutating cells and updating surrounding patterns.
     * @param {string} word - The 7-letter word to insert.
     * @param {number|null} [index=null] - Index to place it. If null, uses the next unfilled slot.
     */
    set_word(word, index = null) {
        if (index === null) {
            index = this.next_unfilled_word_index();
        }
        const pattern = this.words[index];
        this.readable_words[index] = word;
        const [bloom, direction] = wordToBloom(word, pattern);
        if (bloom) {
            const indices = this._word_indices(index);
            for (let i = 0; i < indices.length; i++) {
                const [row, ix2] = indices[i];
                this.rows[row][ix2] = bloom[i];
            }
        }
        this._update_words();
        this.directions[index] = direction;
    }

    /**
     * Helper to clone the current grid and array states to allow non-destructive searches.
     * @private
     * @returns {Object} Saved state snapshot.
     */
    _save_state() {
        return {
            rows: this.rows.map(row => [...row]),
            words: [...this.words],
            readable_words: [...this.readable_words],
            directions: [...this.directions]
        };
    }

    /**
     * Restores the grid and array states from a saved snapshot.
     * @private
     * @param {Object} state - The state snapshot to restore.
     */
    _restore_state(state) {
        this.rows = state.rows.map(row => [...row]);
        this.words = [...state.words];
        this.readable_words = [...state.readable_words];
        this.directions = [...state.directions];
    }

    /**
     * Test-fits a single word candidate in a slot and returns the score (number of valid next-word options).
     * @private
     * @param {string} word - Candidate word to test.
     * @param {number} ix - Slot index.
     * @param {boolean} [lookback=false] - Whether to perform a wrap-around circular lookback check.
     * @param {number} [lookback_words=5] - Required minimum candidate options to pass.
     * @returns {Object|null} An object with {word, score} if valid, or null.
     */
    _test_word(word, ix, lookback = false, lookback_words = 5) {
        const state = this._save_state();
        this.set_word(word, ix);

        let ix2 = ix + 1;
        if (ix === 35) {
            ix2 = 24;
        }
        let words2 = this.word_options(ix2, false);
        if (lookback && words2.size >= lookback_words) {
            let ix0 = ix - 1;
            if (ix === 0) {
                ix0 = 23;
            } else if (ix === 24) {
                ix0 = 35;
            }
            let words3 = this.word_options(ix0, false);
            if (words3.size < 5) {
                words2 = new Set();
            } else {
                words2 = words2.size < words3.size ? words2 : words3;
            }
        }
        const score = words2.size;
        this._restore_state(state);

        if ((score > 0 && !lookback) || (lookback && score >= lookback_words)) {
            return { word, score };
        }
        return null;
    }

    /**
     * Searches for dictionary words that fit the pattern at index, optionally scoring them via lookahead.
     * @param {number|null} [index=null] - Index to query.
     * @param {boolean} [lookahead=true] - Whether to look ahead and score candidate fits.
     * @param {boolean} [lookback=false] - Whether to apply lookback validation.
     * @returns {Array<Object>|Set<string>} A sorted array of {word, score} if lookahead is true, or a Set of strings if false.
     */
    word_options(index = null, lookahead = true, lookback = false) {
        const ix = index === null ? this.next_unfilled_word_index() : index;
        const patt = this.words[ix];
        const options = bloomMatches(patt);

        if (lookahead) {
            const results = [];
            for (const w of options) {
                const res = this._test_word(w, ix, lookback);
                if (res) {
                    results.push(res);
                }
            }
            results.sort((a, b) => b.score - a.score);
            return results;
        } else {
            return options; // returns Set
        }
    }

    /**
     * Main entry point to fetch and score candidate words for the next unfilled slot.
     * Special-cases starting slots (0 and 24) to execute lookback checks.
     * @returns {Array<Object>} List of scored candidate word options.
     */
    find_next_entry_options() {
        const ix = this.next_unfilled_word_index();
        if (ix === null) return [];

        if (ix === 0 || ix === 24) {
            return this.word_options(ix, true, true);
        } else {
            const lookahead = ix < 35;
            const arr = this.word_options(ix, lookahead);
            if (!lookahead) {
                return Array.from(arr).map(w => ({ word: w, score: 0 }));
            } else {
                const ret = [];
                for (const item of arr) {
                    const state = this._save_state();
                    const w = item.word;
                    this.set_word(w, ix);
                    const tmp = this.word_options(ix + 1, false);
                    if (tmp.size > 0) {
                        ret.push({ word: w, score: tmp.size });
                    }
                    this._restore_state(state);
                }
                ret.sort((a, b) => b.score - a.score);
                return ret;
            }
        }
    }
}

/**
 * Draws the Seven Sages grid on a canvas using the background image and returns a PNG data URL.
 * @param {SevenSages} ssInstance - The SevenSages solver instance.
 * @param {HTMLImageElement} gridImage - The loaded background image element.
 * @param {boolean} [filled=true] - Whether to draw letters on the grid.
 * @returns {string} Base64 PNG data URL of the rendered grid.
 */
export function drawGrid(ssInstance, gridImage, filled = true) {
    const canvas = document.createElement('canvas');
    canvas.width = gridImage.width;
    canvas.height = gridImage.height;
    const ctx = canvas.getContext('2d');

    // Draw background image
    ctx.drawImage(gridImage, 0, 0);

    if (filled) {
        ctx.font = '30px DejaVuSans, sans-serif';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const baseRadius = Math.min(centerX, centerY);

        const rings = [
            { letters: 48, radiusFactor: 0.94, startAngle: -Math.PI / 2 + Math.PI / 48, angleOffset: Math.PI / 24 },
            { letters: 24, radiusFactor: 0.83, startAngle: -Math.PI / 2 + Math.PI / 12, angleOffset: Math.PI / 12 },
            { letters: 24, radiusFactor: 0.72, startAngle: -Math.PI / 2 + Math.PI / 12, angleOffset: Math.PI / 12 },
            { letters: 24, radiusFactor: 0.62, startAngle: -Math.PI / 2 + Math.PI / 24, angleOffset: Math.PI / 12 },
            { letters: 12, radiusFactor: 0.52, startAngle: -Math.PI / 2 + Math.PI / 12, angleOffset: Math.PI / 6 },
            { letters: 12, radiusFactor: 0.41, startAngle: -Math.PI / 2 + Math.PI / 12, angleOffset: Math.PI / 6 },
            { letters: 12, radiusFactor: 0.31, startAngle: -Math.PI / 2, angleOffset: Math.PI / 6 }
        ];

        for (let r = 0; r < rings.length; r++) {
            const ringInfo = rings[r];
            const row = ssInstance.rows[r].map(char => char.toUpperCase());
            const radius = baseRadius * ringInfo.radiusFactor;

            for (let i = 0; i < ringInfo.letters; i++) {
                const angle = ringInfo.startAngle + ringInfo.angleOffset * i;
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                ctx.fillText(row[i], x, y);
            }
        }
    }

    return canvas.toDataURL('image/png');
}

