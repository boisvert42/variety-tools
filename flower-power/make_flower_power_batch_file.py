#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Mon Aug 17 10:30:33 2026

@author: alexboisvert

Make a "batch file" for a flower power puzzle
"""

WORD_LENGTH = 7
NUM_PETALS = 16
IS_VARIANT = False

arr = []

# Clockwise (Outside-in)
for x in range(NUM_PETALS):
    s = []
    for y in range(WORD_LENGTH):
        s.append(f"c_{x}_{y}")
    arr.append(s)

if not IS_VARIANT:
    # Counterclockwise
    for p in range(NUM_PETALS):
        s = []
        x = p
        for y in range(WORD_LENGTH):
            s.append(f"c_{x}_{y}")
            x = (x - 1) % NUM_PETALS
        arr.append(s)
else:
    # Inside-out (all words flow clockwise)
    # Clue (NUM_PETALS + 1 + p) curves outward clockwise and ends at outer petal (p + 1), i.e. cell c_p_0
    for p in range(NUM_PETALS):
        s = []
        for y in range(WORD_LENGTH - 1, -1, -1):
            x = (p - y + NUM_PETALS * WORD_LENGTH) % NUM_PETALS
            s.append(f"c_{x}_{y}")
        arr.append(s)
    
out = ''
for x in arr:
    out += ' '.join(x) + "\n"
    
print(out)