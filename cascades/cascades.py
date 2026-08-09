# -*- coding: utf-8 -*-
"""
Helper lookup and path tracer for Cascades puzzles.
"""

# Grid dimensions
ROWS = 12
COLS = 13

# Row 1 (0-indexed 0) has 12 columns: 0 to 11 (column 12 is empty)
# Row 12 (0-indexed 11) has 12 columns: 1 to 12 (column 0 is empty)
# All other rows (1 to 10) have 13 columns: 0 to 12

def in_grid(r, c):
    """Check if (r, c) is a valid cell in the grid."""
    if r < 0 or r >= ROWS or c < 0 or c >= COLS:
        return False
    if r == 0 and c == 12:
        return False
    if r == ROWS - 1 and c == 0:
        return False
    return True

def cell_color(r, c):
    """
    Return cell color ('W' for white/unshaded, 'S' for shaded)
    using the mathematical formula: color(r, c) = [W, W, S, S][(c - r) % 4]
    """
    if not in_grid(r, c):
        return None
    return 'W' if (c - r) % 4 in (0, 1) else 'S'

# Cascade start cells and their color based on grid image:
# Upper-right to lower-left order (A to K):
# A starts at (0, 10) - Shaded
# B starts at (0, 8) - White
# C starts at (0, 6) - Shaded
# D starts at (0, 4) - White
# E starts at (0, 2) - Shaded
# F starts at (0, 0) - White
# G starts at (1, 0) - Shaded
# H starts at (3, 0) - White
# I starts at (5, 0) - Shaded
# J starts at (7, 0) - White
# K starts at (9, 0) - Shaded
CASCADE_STARTS = {
    'A': (0, 10),
    'B': (0, 8),
    'C': (0, 6),
    'D': (0, 4),
    'E': (0, 2),
    'F': (0, 0),
    'G': (1, 0),
    'H': (3, 0),
    'I': (5, 0),
    'J': (7, 0),
    'K': (9, 0),
}

def next_cascade_cell(r, c):
    """
    Given current cell (r, c), find the next cell in the cascade.
    A cascade steps down (r -> r + 1) and zigzags following the same color.
    
    Returns (next_r, next_c) or None if at the bottom row.
    """
    if r >= ROWS - 1:
        return None
    
    color = cell_color(r, c)
    next_r = r + 1
    
    # Check left-down (next_r, c - 1), straight-down (next_r, c), right-down (next_r, c + 1)
    # A cascade preserves the color of the starting cell.
    candidates = []
    for next_c in [c - 1, c, c + 1]:
        if in_grid(next_r, next_c) and cell_color(next_r, next_c) == color:
            candidates.append((next_r, next_c))
            
    # There should only be one valid step down that continues the color path.
    if len(candidates) == 1:
        return candidates[0]
    elif len(candidates) > 1:
        # If there's an ambiguity (rare/shouldn't happen on this grid setup),
        # return the one that is closest or matches the zigzag pattern.
        # Let's see if there is any ambiguity.
        return candidates[0]
    return None

def trace_cascade(name):
    """Return list of (r, c) coordinates for the given cascade name."""
    start = CASCADE_STARTS.get(name)
    if not start:
        return []
    path = [start]
    curr = start
    while True:
        nxt = next_cascade_cell(curr[0], curr[1])
        if nxt:
            path.append(nxt)
            curr = nxt
        else:
            break
    return path

if __name__ == '__main__':
    # Print out all paths to verify they reach the bottom row and trace correctly.
    for name in sorted(CASCADE_STARTS.keys()):
        path = trace_cascade(name)
        path_str = " -> ".join([f"({r},{c})" for r, c in path])
        print(f"Cascade {name} (length {len(path)}): {path_str}")
