# Variety Solver Technical Details

This document provides a technical overview of the Crossword Nexus Variety Puzzle Solver.

## File Structure

- **`index.html`**: The entry point of the solver. Sets up the DOM container layout:
  - An image wrapper `#puzzle-image-container` that holds the background image (`#puzzle-image`), a canvas `#canvas` for drawing user-entered letters, and sizing controls.
  - Clue list containers (`#clue-panels`).
  - Overlay screen for dropping or selecting `.vpuz` files.
  - Basic inline bootstrap script for reading dropped files or URL query parameters and loading them.
- **`script.js`**: Contains the core application logic loaded dynamically:
  - `loadPuzzle(data)`: The main entry point. Sets up the canvas, event handlers, parses `vpuz` fields, and draws state.
  - `readVpuz(data)`: Preprocesses the custom `vpuz` format (essentially iPuz with `puzzle-image`, `solution-string`, etc.) and standardizes clues.
  - `drawLetter(...)` / `removeLetter(...)`: Canvas manipulation functions for adding, updating, and deleting letters at specific coordinate offsets.
  - `checkIfSolved(...)`: Compares user input letters to sorted solution strings and triggers confetti.
- **`styles.css`**: Styling rules for overlays, clue lists, inputs, grids, and font slider controls.

## State Management

- **Local Storage**: Saved states are cached via the `lscache` library.
  - The cache key is generated dynamically from a hash of the `.vpuz` content (using `hashCode`).
  - Letters are stored under key: `cnvs_letters_<hash>` as an array of objects: `{ x, y, letter, width, height }`.
  - Clue notes are stored under key: `cnvs_notes_<hash>` as an array of text strings.
  - Completed clues are stored under key: `cnvs_completed_<hash>` as an array of booleans.

## Clue Note Inputs & Completed States (`input-box` / `clue-item`)

- The `.clue-item` list elements contain:
  - `.clue-number` span
  - `.clue-text` span
  - `.input-box` text input (hidden by default)
  - `.cluenote-button` pencil icon button (hidden by default)
- Hovering over a `.clue-item` reveals the `.cluenote-button` (pencil icon) if the clue's input-box note is empty.
- Clicking the `.cluenote-button` opens the `.input-box` for editing.
- Clicking the clue itself toggles the `.completed` class, which grays out the clue text and saves the state to localStorage.
