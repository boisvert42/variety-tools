/**
 * Seven Sages Construction (JS Port)
 * (c) 2026, Crossword Nexus / Antigravity
 * MIT License
 */

let WORDS = [];
const WORD_SCORES = new Map();

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

export function getWordScore(word) {
    return WORD_SCORES.get(word.toLowerCase()) || 0;
}

function alphaOnly(s) {
    return s.toLowerCase().replace(/[^a-z]+/g, '');
}

function bloomPatterns1(input, backward = false) {
    let str = backward ? input.split('').reverse().join('') : input;
    const patterns = new Set();
    for (let i = 0; i < 7; i++) {
        const pat = str.slice(i) + str.slice(0, i);
        patterns.add(pat);
    }
    return patterns;
}

function bloomPatterns(input) {
    const p1 = bloomPatterns1(input, false);
    const p2 = bloomPatterns1(input, true);
    return new Set([...p1, ...p2]);
}

function matchesPattern(word, pattern) {
    for (let i = 0; i < 7; i++) {
        const pChar = pattern[i];
        if (pChar !== '.' && pChar !== word[i]) {
            return false;
        }
    }
    return true;
}

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

export class SevenSages {
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

    remove_word_at(index) {
        const words = [...this.readable_words];
        this.reset(null);
        for (let i = 0; i < words.length; i++) {
            if (i !== index && /^[a-z]+$/i.test(words[i])) {
                this.set_word(words[i], i);
            }
        }
    }

    next_unfilled_word_index() {
        for (let i = 0; i < this.words.length; i++) {
            if (!/^[a-z]+$/i.test(this.words[i])) {
                return i;
            }
        }
        return null;
    }

    _word_indices(jx) {
        const ix = jx + 1;
        if (ix <= 24) {
            return [
                [0, 2 * (ix - 1)],
                [0, (ix - 1) * 2 + 1],
                [1, ix - 1],
                [2, ix - 1],
                [3, ix - 1],
                [2, (ix - 2 + 24) % 24],
                [1, (ix - 2 + 24) % 24]
            ];
        } else {
            return [
                [3, ((ix - 25) * 2) % 24],
                [4, ix - 25],
                [5, ix - 25],
                [6, ix - 25],
                [5, (ix - 26 + 12) % 12],
                [4, (ix - 26 + 12) % 12],
                [3, (((ix - 26) * 2) % 24) + 1]
            ];
        }
    }

    _word_at(jx) {
        let ret = '';
        const indices = this._word_indices(jx);
        for (const [row, ix2] of indices) {
            ret += this.rows[row][ix2];
        }
        return ret;
    }

    _update_words() {
        this.words = [];
        for (let i = 0; i < 36; i++) {
            this.words.push(this._word_at(i));
        }
    }

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

    _save_state() {
        return {
            rows: this.rows.map(row => [...row]),
            words: [...this.words],
            readable_words: [...this.readable_words],
            directions: [...this.directions]
        };
    }

    _restore_state(state) {
        this.rows = state.rows.map(row => [...row]);
        this.words = [...state.words];
        this.readable_words = [...state.readable_words];
        this.directions = [...state.directions];
    }

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
