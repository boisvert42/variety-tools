# Twists and Turns Puzzle Type & Constructor Implementation Details

This document outlines the rules, mathematical properties, and implementation details for the Twists & Turns crossword puzzle constructor.

---

## 1. Puzzle Rules & Grid Architecture

A standard **Twists & Turns** puzzle consists of a **15x15 grid** containing 225 letters. Grid contents are shared by two intersecting crossword entry systems: **Twists** and **Turns**.

### Twists
* The grid is divided into a 5x5 layout of **3x3 blocks** (25 blocks total).
* Each block contains a single **9-letter word** (the Twist).
* Twist words are entered along a non-overlapping, non-diagonal spiral path within the 3x3 block.
* Clues for Twists are listed in standard reading order of the blocks (left-to-right, top-to-bottom).

### Turns
* Turns are words placed consecutively from start to end along a single continuous snake-like path (boustrophedon) covering all 225 cells of the 15x15 grid.
* The snake path proceeds left-to-right in odd-indexed rows (1, 3, 5...) and right-to-left in even-indexed rows (2, 4, 6...).
* Turn words are of varying lengths and flow directly into one another.

---

## 2. Spiral Path Mathematics (The 16 Configurations)

For any 3x3 block, there are exactly **16 valid spiral paths** of length 9:

1. **Inward Spirals (8 total)**:
   * Start at one of the **4 corners** (`(0,0)`, `(0,2)`, `(2,0)`, or `(2,2)`).
   * Loop either **clockwise** (CW) or **counterclockwise** (CCW) to terminate at the center cell `(1,1)`.
2. **Outward Spirals (8 total)**:
   * Start at the center cell `(1,1)`.
   * Step in one of the **4 cardinal directions** (North, East, South, West).
   * Loop either **clockwise** (CW) or **counterclockwise** (CCW) to terminate at one of the 4 corners.

### Coordinate Coordinate Mappings
Using 1D indices for the 3x3 block (`index = 3 * row + col`):
* `0=top-left`, `1=top-mid`, `2=top-right`, `3=mid-left`, `4=center`, `5=mid-right`, `6=bot-left`, `7=bot-mid`, `8=bot-right`.

```javascript
const SPIRAL_PATHS = [
  // Corner-to-Center Inward (8 paths)
  [0, 1, 2, 5, 8, 7, 6, 3, 4], // Corner 0 CW
  [0, 3, 6, 7, 8, 5, 2, 1, 4], // Corner 0 CCW
  [2, 5, 8, 7, 6, 3, 0, 1, 4], // Corner 2 CW
  [2, 1, 0, 3, 6, 7, 8, 5, 4], // Corner 2 CCW
  [8, 7, 6, 3, 0, 1, 2, 5, 4], // Corner 8 CW
  [8, 5, 2, 1, 0, 3, 6, 7, 4], // Corner 8 CCW
  [6, 3, 0, 1, 2, 5, 8, 7, 4], // Corner 6 CW
  [6, 7, 8, 5, 2, 1, 0, 3, 4], // Corner 6 CCW

  // Center-to-Perimeter Outward (8 paths)
  [4, 1, 2, 5, 8, 7, 6, 3, 0], // Center to N CW
  [4, 1, 0, 3, 6, 7, 8, 5, 2], // Center to N CCW
  [4, 5, 8, 7, 6, 3, 0, 1, 2], // Center to E CW
  [4, 5, 2, 1, 0, 3, 6, 7, 8], // Center to E CCW
  [4, 7, 6, 3, 0, 1, 2, 5, 8], // Center to S CW
  [4, 7, 8, 5, 2, 1, 0, 3, 6], // Center to S CCW
  [4, 3, 0, 1, 2, 5, 8, 7, 6], // Center to W CW
  [4, 3, 6, 7, 8, 5, 2, 1, 0]  // Center to W CCW
];
```

---

## 3. Snake Path Traversals

Because the snake path snakes back-and-forth across the 15x15 grid, a 3x3 block is traversed differently depending on whether it is in an even or odd block row (0, 2, 4 vs. 1, 3):

* **Even Row Blocks** (traversed L-to-R on row 0, R-to-L on row 1, L-to-R on row 2):
  `Traversal order: [0, 1, 2, 5, 4, 3, 6, 7, 8]`
* **Odd Row Blocks** (traversed R-to-L on row 0, L-to-R on row 1, R-to-L on row 2):
  `Traversal order: [2, 1, 0, 3, 4, 5, 8, 7, 6]`

---

## 4. Constraint Solving & Search Heuristic

To verify if a 9-letter Twist word candidate works within a block:

1. **Grid Mapping**:
   A candidate 9-letter Twist word $W$ is mapped to the 3x3 grid cells $G[0..8]$ using spiral path $P$:
   $$G[c] = W[\text{indexOf}(P, c)]$$

2. **Variable & Constant Binding**:
   A layout template (e.g., `aAABBBCCC`) is defined in standard **grid cell order** (left-to-right, top-to-bottom).
   * Constants (e.g. `'a'` at cell 0) are validated directly on the grid: $G[0] === 'a'$.
   * Variables are extracted directly as consecutive substrings from the grid cells in reading order:
     * `A` = $G[1]G[2]$
     * `B` = $G[3]G[4]G[5]$
     * `C` = $G[6]G[7]G[8]$

3. **Fast Turn Validation & Counts**:
   Turn constraints are written in relation to the forward grid-order variables. If a variable $B$ is traversed in reverse by the snake path, the constraint uses the reverse modifier `~B`.
   When Turn constraints are checked (e.g., `aA*` or `*~Bge`), we verify that at least one dictionary word matches and track the count:
   * **Prefix checking & counts (`PREFIX*`)**: Verified and counted in $O(1)$ using `prefixMap`.
   * **Suffix checking & counts (`*SUFFIX`)**: Verified and counted in $O(1)$ using `suffixMap`.
   * **Reversed variables (`~V`)**: Handled by reversing the string value bound to variable $V$ before checking the suffix/prefix maps.
   
The constructor displays the resolved Turn constraint strings (e.g., `aLA*`) and the grid-order sequence `Seq` ($G$ in standard left-to-right, top-to-bottom reading order), helping the puzzle creator make informed choices about grid flexibility.

---

## 5. Candidate Ordering & Sorting Mechanism

To bubble the most flexible candidate Twist words to the top, matches are sorted by the **bottleneck constraint** heuristic:
1. For each candidate Twist word, we collect the match counts of all Turn constraints.
2. We sort these counts in ascending order (e.g., if a candidate has constraint counts of `[150, 12, 45]`, its sorted count array is `[12, 45, 150]`).
3. We sort the list of candidate Twist words **descending lexicographically** based on these sorted count arrays.
   * This ensures candidates with the largest minimum constraint count (most open options in their tightest slot) are bubbled to the top first, followed by the second-largest, etc.
   * If any slot has zero options, the candidate is discarded.



