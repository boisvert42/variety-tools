const gridContainer = document.querySelector(".grid-container");
const numRows = 14;
const numCols = 12;
let selectedPath = [];
let fullPath = [];

// Initialize the grid and make each cell clickable
for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
        const cell = document.createElement("div");
        cell.classList.add("cell");
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.id = `cell-${row}-${col}`;
        cell.addEventListener("click", () => selectPathCell(row, col));
        gridContainer.appendChild(cell);
    }
}

// Function to handle cell selection for the path
function selectPathCell(row, col) {
    if (selectedPath.some(coord => coord.row === row && coord.col === col)) {
        alert("This cell is already in the path!");
        return;
    }

    selectedPath.push({ row, col });
    const cell = document.getElementById(`cell-${row}-${col}`);
    cell.classList.add("path-selected");
}

// Place the first word and generate the full labyrinth
function placeFirstWord() {
    const word = document.getElementById("firstWordInput").value.toUpperCase();

    console.log(selectedPath);

    if (word.length !== selectedPath.length) {
        alert(`Please select exactly ${word.length} cells for the word.`);
        return;
    }

    // Place each letter in the selected path
    for (let i = 0; i < word.length; i++) {
        const { row, col } = selectedPath[i];
        const cell = document.getElementById(`cell-${row}-${col}`);
        cell.textContent = word[i];
        cell.classList.add("filled");
    }

    // Start generating the full labyrinth path
    generateFullLabyrinth();
}

// Recursive function to generate the full labyrinth path with symmetry
function generateFullLabyrinth() {
    fullPath = [...selectedPath]; // Start with the user-defined path
    if (fillLabyrinthPath()) {
        drawLabyrinthWalls();
    } else {
        alert("Failed to generate a valid labyrinth.");
    }
}

function fillLabyrinthPath() {
    fullPath = [...selectedPath]; // Start with the user-defined path

    // Try to expand the path symmetrically from the last cell in selectedPath
    if (expandPathSymmetrically()) {
        drawLabyrinthWalls(); // Once filled, draw walls
    } else {
        alert("Could not generate a valid labyrinth path.");
    }
}

function expandPathSymmetrically() {
    // Base case: stop if we've filled half the grid, symmetry completes the other half
    if (fullPath.length >= (numRows * numCols) / 2) {
        return true;
    }

    // Current last cells in the path to expand from
    const cellsToExpand = [...fullPath]; // Work with a copy to prevent modification during iteration

    for (const cell of cellsToExpand) {
        // Try all possible moves (right, down, left, up)
        const moves = [
            { row: 0, col: 1 },
            { row: 1, col: 0 },
            { row: 0, col: -1 },
            { row: -1, col: 0 }
        ];

        for (const move of moves) {
            const newRow = cell.row + move.row;
            const newCol = cell.col + move.col;
            const symmetricCells = getSymmetricCells(newRow, newCol);

            // Check if the new cell and its symmetric counterparts can be added
            if (canAddToPath(symmetricCells)) {
                // Add all symmetric cells to the path
                symmetricCells.forEach(({ row, col }) => {
                    fullPath.push({ row, col });
                });

                // Recursively expand the path
                if (expandPathSymmetrically()) {
                    return true;
                }

                // Backtrack if this path doesn't work
                symmetricCells.forEach(({ row, col }) => {
                    fullPath = fullPath.filter(cell => cell.row !== row || cell.col !== col);
                });
            }
        }
    }

    return false; // No valid path found
}

// Check if symmetric cells can be safely added to the path
function canAddToPath(symmetricCells) {
    return symmetricCells.every(({ row, col }) => {
        return row >= 0 && row < numRows && col >= 0 && col < numCols &&
            !fullPath.some(cell => cell.row === row && cell.col === col);
    });
}

// Get the symmetric counterparts of a cell
function getSymmetricCells(row, col) {
    return [
        { row: row, col: col },
        { row: 13 - row, col: col },        // Vertical mirror
        { row: row, col: 11 - col },        // Horizontal mirror
        { row: 13 - row, col: 11 - col }    // Double mirror
    ];
}


// Draw walls between path cells to indicate labyrinth boundaries
function drawLabyrinthWalls() {
    fullPath.forEach((cell, index) => {
        if (index === 0) return; // Skip the first cell

        const prevCell = fullPath[index - 1];
        addWallBetweenCells(prevCell, cell);
    });
}

function addWallBetweenCells(cell1, cell2) {
    const cellElement1 = document.getElementById(`cell-${cell1.row}-${cell1.col}`);
    const cellElement2 = document.getElementById(`cell-${cell2.row}-${cell2.col}`);

    if (cell1.row === cell2.row) {
        if (cell1.col < cell2.col) {
            cellElement1.style.borderRight = "2px solid black";
            cellElement2.style.borderLeft = "2px solid black";
        } else {
            cellElement1.style.borderLeft = "2px solid black";
            cellElement2.style.borderRight = "2px solid black";
        }
    } else if (cell1.col === cell2.col) {
        if (cell1.row < cell2.row) {
            cellElement1.style.borderBottom = "2px solid black";
            cellElement2.style.borderTop = "2px solid black";
        } else {
            cellElement1.style.borderTop = "2px solid black";
            cellElement2.style.borderBottom = "2px solid black";
        }
    }
}
