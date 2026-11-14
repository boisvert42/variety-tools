#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Variety Spiral Generator
========================

Generates fill for a Variety Spiral puzzle where:
  - N words go in the forward (inward) direction without gaps.
  - In the backward (outward) direction, words are separated by 1-letter gaps.
  - The gap letters, read in the backward direction, spell out target word W.

Example (N = 2, W = "TO"):
  Forward:  MAJORETTES / TYLENOL
  Backward: LONELY (T) SETTER (O) JAM

Can be run:
  1. Interactively in Spyder using the #%% cell blocks.
  2. From the command line:
       python variety_spiral.py -N 2 -W TO
"""

from collections import defaultdict
import os
from pathlib import Path
import sys

# =============================================================================
# %% [1] Configuration and Parameters
# =============================================================================

# Number of forward words
N_FORWARD = 2

# Target word spelled by the gaps in the backward direction
TARGET_W = "TO"

# Minimum and maximum length constraints
MIN_FWD_LEN = 4
MAX_FWD_LEN = 15
MIN_BWD_LEN = 4
MAX_BWD_LEN = 15

# Minimum score for wordlist entries (spreadthewordlist standard scores 0-100)
MIN_SCORE = 50

# Candidate file paths for the wordlist (checked in order)
DEFAULT_WORDLIST_PATHS = [
    Path("spreadthewordlist.dict"),
    Path(__file__).parent / "spreadthewordlist.dict",
    Path(__file__).parent.parent / "word_lists" / "spreadthewordlist.dict",
    Path("helper_dict.json"),
    Path(__file__).parent / "helper_dict.json",
]


# =============================================================================
# %% [2] Wordlist Loader and Index Builder
# =============================================================================

def load_words_and_scores(file_path=None, min_score=MIN_SCORE):
    """
    Loads words and their scores from spreadthewordlist.dict or helper_dict.json.
    Returns: dict[word -> score]
    """
    chosen_path = None
    if file_path:
        p = Path(file_path)
        if p.exists():
            chosen_path = p
    if not chosen_path:
        for p in DEFAULT_WORDLIST_PATHS:
            if p.exists():
                chosen_path = p
                break

    word_scores = {}

    if chosen_path is None:
        print("[!] No wordlist file found. Checked:")
        for p in DEFAULT_WORDLIST_PATHS:
            print(f"    - {p}")
        return word_scores

    print(f"[*] Loading wordlist from: {chosen_path}")

    if chosen_path.suffix == ".json":
        import json
        with open(chosen_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            # helper_dict structure: {'begin': {...}, 'end': {...}}
            for category in ("begin", "end"):
                for entry_list in data.get(category, {}).values():
                    for entry in entry_list:
                        words = entry.get("words", [])
                        score = entry.get("score", 50)
                        for w in words:
                            if w and isinstance(w, str):
                                w_clean = w.strip().upper()
                                if w_clean.isalpha():
                                    word_scores[w_clean] = max(
                                        word_scores.get(w_clean, 0), score // len(words)
                                    )
    else:
        # Standard dictionary file: format WORD;SCORE or single word per line
        with open(chosen_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if ";" in line:
                    parts = line.split(";")
                    w = parts[0].strip().upper()
                    try:
                        sc = int(parts[1].strip())
                    except ValueError:
                        sc = 50
                else:
                    w = line.strip().upper()
                    sc = 50

                if w.isalpha() and sc >= min_score:
                    word_scores[w] = max(word_scores.get(w, 0), sc)

    print(f"[*] Loaded {len(word_scores):,} words (min score >= {min_score}).")
    return word_scores


class WordIndices:
    """
    Precomputes fast lookup indexes for forward and backward words:
      - fwd_by_prefix: prefix -> list of forward words
      - bwd_by_suffix: suffix -> list of backward words
      - Sets for exact membership check
    """

    def __init__(self, word_scores,
                 min_fwd=MIN_FWD_LEN, max_fwd=MAX_FWD_LEN,
                 min_bwd=MIN_BWD_LEN, max_bwd=MAX_BWD_LEN):
        self.word_scores = word_scores
        self.min_fwd = min_fwd
        self.max_fwd = max_fwd
        self.min_bwd = min_bwd
        self.max_bwd = max_bwd

        self.fwd_words = set()
        self.bwd_words = set()

        self.fwd_by_prefix = defaultdict(list)
        self.bwd_by_suffix = defaultdict(list)

        for w, sc in word_scores.items():
            l = len(w)
            if min_fwd <= l <= max_fwd:
                self.fwd_words.add(w)
                for i in range(l + 1):
                    self.fwd_by_prefix[w[:i]].append(w)

            if min_bwd <= l <= max_bwd:
                self.bwd_words.add(w)
                for i in range(l + 1):
                    self.bwd_by_suffix[w[l - i:]].append(w)

        # Sort candidate lists by score descending for greedy/best-first quality
        for pref in self.fwd_by_prefix:
            self.fwd_by_prefix[pref].sort(
                key=lambda w: self.word_scores.get(w, 0), reverse=True
            )
        for suff in self.bwd_by_suffix:
            self.bwd_by_suffix[suff].sort(
                key=lambda w: self.word_scores.get(w, 0), reverse=True
            )

        print(f"[*] Indexed {len(self.fwd_words):,} forward words and {len(self.bwd_words):,} backward words.")


# =============================================================================
# %% [3] Variety Spiral Search Engine
# =============================================================================

class VarietySpiralSolver:
    """
    Solves for N forward words and (len(W)+1) backward words matching target gaps W.
    
    Notation:
      - S_fwd: The concatenated forward stream F_0 + F_1 + ... + F_{N-1}
      - In S_fwd, reading left to right:
          Segment 0: R_0 = B_M^R
          Gap 0:     G_0 = W[M-1]
          Segment 1: R_1 = B_{M-1}^R
          ...
          Gap M-1:   G_{M-1} = W[0]
          Segment M: R_M = B_0^R
      - Each B_k = R_{M-k}^R is a valid backward word.
      - S_back = reverse(S_fwd) = B_0 + W[0] + B_1 + ... + W[M-1] + B_M
    """

    def __init__(self, indices: WordIndices, n_forward: int, target_w: str):
        self.indices = indices
        self.N = n_forward
        self.W = target_w.upper()
        self.M = len(self.W)

        # Gaps in forward stream order: W reversed!
        # Gap index k in forward stream (0 <= k < M) is W[M - 1 - k]
        self.fwd_gaps = [self.W[self.M - 1 - k] for k in range(self.M)]

    def solve(self, max_solutions=50, max_fwd_starters=1000):
        """
        Runs backtracking search and yields valid solutions.
        """
        solutions = []
        seen_solutions = set()

        # Precompute length bounds
        # For forward:
        min_fwd_len = self.indices.min_fwd
        max_fwd_len = self.indices.max_fwd
        # For backward:
        min_bwd_len = self.indices.min_bwd
        max_bwd_len = self.indices.max_bwd

        # Total pattern words is M + 1, plus M single-letter gaps
        min_total_len = max(self.N * min_fwd_len, (self.M + 1) * min_bwd_len + self.M)
        max_total_len = min(self.N * max_fwd_len, (self.M + 1) * max_bwd_len + self.M)

        if min_total_len > max_total_len:
            print("[!] Constraints incompatible: forward and backward length ranges do not overlap.")
            return solutions

        def search(fwd_words, pat_words, s_fwd, s_pat, at_gap, used_words):
            if len(solutions) >= max_solutions:
                return

            i_fwd = len(fwd_words)
            k_pat = len(pat_words)

            # Check if complete
            if i_fwd == self.N and k_pat == self.M + 1 and not at_gap and len(s_fwd) == len(s_pat):
                # Valid solution found!
                # Backward words: B_0, B_1, ..., B_M
                # pat_words are R_0, R_1, ..., R_M where R_k = B_{M-k}^R
                # So B_k = pat_words[M - k][::-1]
                bwd_words = [pat_words[self.M - k][::-1] for k in range(self.M + 1)]

                sol_key = (tuple(fwd_words), tuple(bwd_words))
                if sol_key not in seen_solutions:
                    seen_solutions.add(sol_key)
                    score = sum(self.indices.word_scores.get(w, 0) for w in fwd_words + bwd_words)
                    sol_dict = {
                        "forward": fwd_words,
                        "backward": bwd_words,
                        "stream": s_fwd,
                        "score": score,
                        "length": len(s_fwd),
                    }
                    solutions.append(sol_dict)
                return

            # Length bounds check for remaining portions
            rem_fwd_count = self.N - i_fwd
            rem_pat_words = (self.M + 1) - k_pat
            # Remaining gaps: if currently at gap, this gap plus any remaining
            rem_gaps = (self.M - k_pat + 1) if at_gap else (self.M - k_pat)

            cur_fwd_len = len(s_fwd)
            cur_pat_len = len(s_pat)

            min_final_fwd = cur_fwd_len + rem_fwd_count * min_fwd_len
            max_final_fwd = cur_fwd_len + rem_fwd_count * max_fwd_len

            min_final_pat = cur_pat_len + rem_gaps + rem_pat_words * min_bwd_len
            max_final_pat = cur_pat_len + rem_gaps + rem_pat_words * max_bwd_len

            # If feasible ranges don't overlap, prune!
            if min_final_fwd > max_final_pat or min_final_pat > max_final_fwd:
                return

            # Branching logic:
            delta = cur_fwd_len - cur_pat_len

            # -------------------------------------------------------------
            # CASE A: Pattern is behind or at gap (delta > 0 or at_gap)
            # -------------------------------------------------------------
            if at_gap:
                # Next character in pattern MUST be the gap character
                gap_char = self.fwd_gaps[k_pat - 1]
                if cur_pat_len < cur_fwd_len:
                    if s_fwd[cur_pat_len] != gap_char:
                        return  # Mismatch with forward stream!
                    # Gap matches forward stream
                    search(fwd_words, pat_words, s_fwd, s_pat + gap_char, False, used_words)
                else:
                    # cur_pat_len == cur_fwd_len: pattern is catching up to forward
                    search(fwd_words, pat_words, s_fwd, s_pat + gap_char, False, used_words)
                return

            if delta > 0:
                # We need next pattern word R_k (which corresponds to B_{M-k}^R)
                if k_pat > self.M:
                    return  # No more pattern words allowed

                rem_slice = s_fwd[cur_pat_len:]  # characters R_k must start with (or equal)
                req_len = len(rem_slice)

                candidates = []

                # Option 1: len(R_k) <= len(rem_slice)
                # Then R_k is exactly rem_slice[:L], so B = R_k[::-1]
                for l in range(min_bwd_len, min(req_len, max_bwd_len) + 1):
                    cand_b = rem_slice[:l][::-1]
                    if cand_b in self.indices.bwd_words and cand_b not in used_words:
                        candidates.append(cand_b)

                # Option 2: len(R_k) > len(rem_slice)
                # Then R_k starts with rem_slice, meaning B ends with rem_slice[::-1]
                if req_len <= max_bwd_len:
                    suff = rem_slice[::-1]
                    for cand_b in self.indices.bwd_by_suffix.get(suff, []):
                        if len(cand_b) > req_len and cand_b not in used_words:
                            candidates.append(cand_b)

                for cand_b in candidates:
                    cand_r = cand_b[::-1]
                    next_at_gap = (k_pat + 1 <= self.M)
                    used_words.add(cand_b)
                    search(fwd_words, pat_words + [cand_r], s_fwd, s_pat + cand_r, next_at_gap, used_words)
                    used_words.remove(cand_b)
                    if len(solutions) >= max_solutions:
                        return
                return

            # -------------------------------------------------------------
            # CASE B: Forward is behind or equal (delta <= 0)
            # -------------------------------------------------------------
            if i_fwd >= self.N:
                return  # No more forward words allowed

            if delta < 0:
                # cur_pat_len > cur_fwd_len: next F_i must start with s_pat[cur_fwd_len:]
                rem_slice = s_pat[cur_fwd_len:]
                req_len = len(rem_slice)

                candidates = []
                # Option 1: len(F) <= req_len -> F == rem_slice[:l]
                for l in range(min_fwd_len, min(req_len, max_fwd_len) + 1):
                    cand_f = rem_slice[:l]
                    if cand_f in self.indices.fwd_words and cand_f not in used_words:
                        candidates.append(cand_f)

                # Option 2: len(F) > req_len -> F starts with rem_slice
                if req_len <= max_fwd_len:
                    for cand_f in self.indices.fwd_by_prefix.get(rem_slice, []):
                        if len(cand_f) > req_len and cand_f not in used_words:
                            candidates.append(cand_f)

                for cand_f in candidates:
                    used_words.add(cand_f)
                    search(fwd_words + [cand_f], pat_words, s_fwd + cand_f, s_pat, at_gap, used_words)
                    used_words.remove(cand_f)
                    if len(solutions) >= max_solutions:
                        return
                return

            else:
                # delta == 0: perfectly aligned at the start or boundary!
                # Pick next forward word F_i
                starters = self.indices.fwd_by_prefix.get("", [])
                count = 0
                for cand_f in starters:
                    if cand_f in used_words:
                        continue
                    used_words.add(cand_f)
                    search(fwd_words + [cand_f], pat_words, s_fwd + cand_f, s_pat, at_gap, used_words)
                    used_words.remove(cand_f)
                    count += 1
                    if len(solutions) >= max_solutions or (i_fwd == 0 and count >= max_fwd_starters):
                        break

        # Kick off search
        search([], [], "", "", False, set())

        # Sort solutions by score descending
        solutions.sort(key=lambda s: s["score"], reverse=True)
        return solutions


# =============================================================================
# %% [4] Pretty Printing and Formatting
# =============================================================================

def print_solution(sol, target_w):
    """
    Nicely formats a variety spiral solution.
    """
    fwd_words = sol["forward"]
    bwd_words = sol["backward"]
    stream = sol["stream"]
    score = sol["score"]
    w_clean = target_w.upper()

    fwd_str = " / ".join(f"{w} ({len(w)})" for w in fwd_words)

    # Backward string with (GAP)
    bwd_parts = []
    for k, bw in enumerate(bwd_words):
        bwd_parts.append(f"{bw} ({len(bw)})")
        if k < len(w_clean):
            bwd_parts.append(f"({w_clean[k]})")
    bwd_str = " ".join(bwd_parts)

    print("=" * 70)
    print(f"Total Score: {score}  |  Total Length: {sol['length']} letters")
    print(f"FORWARD ({len(fwd_words)} words) : {fwd_str}")
    print(f"BACKWARD ({len(bwd_words)} words): {bwd_str}")
    print(f"STREAM (Fwd)     : {stream}")
    print(f"STREAM (Bwd)     : {stream[::-1]}")
    print("=" * 70)


# =============================================================================
# %% [5] Interactive Chooser & Step-by-Step Exploration
# =============================================================================

def interactive_explore(indices, n_forward=2, target_w="TO", initial_fwd=None):
    """
    Allows exploring completions given a chosen starting word or step-by-step.
    """
    solver = VarietySpiralSolver(indices, n_forward, target_w)
    print(f"\n[*] Searching solutions for N = {n_forward}, W = '{target_w}'...")

    if initial_fwd:
        initial_fwd = initial_fwd.strip().upper()
        print(f"[*] Constraining forward word 1 = '{initial_fwd}'")

    sols = solver.solve(max_solutions=20, max_fwd_starters=2000)

    if initial_fwd:
        sols = [s for s in sols if s["forward"] and s["forward"][0] == initial_fwd]

    if not sols:
        print("[!] No solutions found with current constraints.")
    else:
        print(f"[+] Found {len(sols)} solution(s):\n")
        for i, sol in enumerate(sols, 1):
            print(f"--- Option #{i} ---")
            print_solution(sol, target_w)
            print()
    return sols


# =============================================================================
# %% [6] Main Execution (CLI or Direct Run)
# =============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Variety Spiral Generator")
    parser.add_argument("-N", "--n_forward", type=int, default=N_FORWARD,
                        help=f"Number of forward words (default: {N_FORWARD})")
    parser.add_argument("-W", "--word", type=str, default=TARGET_W,
                        help=f"Target word spelled by backward gaps (default: {TARGET_W})")
    parser.add_argument("--dict", type=str, default=None,
                        help="Path to wordlist file")
    parser.add_argument("--min-score", type=int, default=MIN_SCORE,
                        help=f"Minimum word score (default: {MIN_SCORE})")
    parser.add_argument("--max-results", type=int, default=10,
                        help="Maximum solutions to return (default: 10)")
    parser.add_argument("--fwd-seed", type=str, default=None,
                        help="Optional first forward word to start with")

    args = parser.parse_args()

    # Load words and build indices
    words_and_scores = load_words_and_scores(file_path=args.dict, min_score=args.min_score)
    if not words_and_scores:
        sys.exit(1)

    indices = WordIndices(words_and_scores)

    if args.fwd_seed:
        interactive_explore(indices, n_forward=args.n_forward, target_w=args.word, initial_fwd=args.fwd_seed)
    else:
        solver = VarietySpiralSolver(indices, n_forward=args.n_forward, target_w=args.word)
        print(f"\n[*] Searching for N = {args.n_forward}, W = '{args.word}'...")
        solutions = solver.solve(max_solutions=args.max_results)

        if not solutions:
            print("[!] No valid spirals found for these parameters.")
        else:
            print(f"[+] Found {len(solutions)} solution(s):\n")
            for sol in solutions:
                print_solution(sol, args.word)


if __name__ == "__main__":
    main()
