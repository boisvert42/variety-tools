# Variety Solver Technical Details

This document provides a technical overview of the Crossword Nexus Variety Puzzle Solver.

## File Structure

- **`index.html`**: The entry point of the solver. Sets up the DOM container layout:
  - An image wrapper `#puzzle-image-container` that holds the background image (`#puzzle-image`), a canvas `#canvas` for drawing user-entered letters, and sizing controls.
  - Clue list containers (`#clue-panels`).
  - Mobile clue banner (`#mobile-clue-bar`) for single-clue top navigation on screens below 768px.
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

## Responsive / Mobile View

- When the viewport width is 768px or less:
  - The side `#clue-panels` are hidden.
  - The top `#mobile-clue-bar` becomes visible with `<` and `>` buttons to navigate clues.
  - The top bar has a fixed height (72px) that never expands or shrinks; clue font size dynamically scales to fit the container without shifting the layout.
  - The clue header displays the clue number and direction/title if multiple clue lists exist (e.g., `1 Counterclockwise`), or just the number if there is only a single clue list.
  - Clue text is shown below the header, with any active notes.
  - Tapping the clue text toggles its completed state (strikethrough / grayed out), synchronized with `localStorage` and the desktop list.
  - Horizontal touch swiping across the mobile clue bar advances to the next or previous clue.
  - **On-Screen Virtual Keyboard (`#virtual-keyboard`)**:
    - Appears docked at the bottom of the screen by default on screens 768px wide or less.
    - Features a 3-row QWERTY layout with `⌫` (backspace), `+`, and `▾ Hide` buttons.
    - Tapping a grid cell displays the circle highlight; tapping any letter or backspace key immediately draws or deletes the letter on the canvas.
    - Tapping `▾ Hide` collapses the keyboard and displays a floating pill button (`#vk-show-button`, labeled `⌨ Keyboard`) in the bottom right corner to quickly restore it.
    - The collapse state is preserved across clues within the session via `sessionStorage` (`cnvs_vk_hidden`).
    - The puzzle container automatically adds bottom clearance (`160px`) when the keyboard is open so the full grid remains scrollable.
    - **Control Visibility & Dynamic Sizing**: To maximize puzzle grid real estate, `.button-container` (Info, Print, font slider) is automatically hidden on mobile while the keyboard is visible, and reappears when the keyboard is collapsed. `#puzzle-image` dynamically limits its height (`calc(100dvh - 245px)`) when the keyboard is active so the grid fits above the keyboard without overlap, and expands (`calc(100dvh - 145px)`) when collapsed. A `ResizeObserver` monitors `#puzzle-image` and calls `resizeAndRedraw()` automatically to keep `<canvas>` and letters in sync.

