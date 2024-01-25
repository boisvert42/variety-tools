# -*- coding: utf-8 -*-
"""
Created on Mon Mar  7 13:56:02 2022

@author: boisv
"""
import json
from collections import OrderedDict

title = 'Trail Mix'
author = 'YOUR_NAME_HERE'
_copyright = 'YOUR_COPYRIGHT_HERE'

OUTFILE = 'trail_mix.ipuz'

rows = '''
ROWS_CLUES_HERE
'''.strip().split('\n')

trails = '''
TRAILS_CLUES_HERE
'''.strip().split('\n')

rows_arr = []
for i, c in enumerate(rows):
    rows_arr.append([str(i+1), c])
trails_arr = [['', c] for c in trails]

clues = OrderedDict([('Rows', rows_arr), ('Trails', trails_arr)])

#%%
grid = '''
AABBBBBBBBBBC
AAAAADBCCCCCC
AEEEDDFFFFCCC
EEGGDDDDFFHHC
EEGGGIIFFJJHH
EEGGIIIKKKJHH
ELLGIIIKKJJHH
LLLMMIIKJJNNN
OLLMMKKKPPNNN
OMMMMQKPPPPNN
OOOOOQRRRRPPP
OOOQQQQQRPPPP
OOOOQQQRRRRRP
'''.strip().split('\n')

#%% Set up the grid
puzzle = []
height = len(grid)
width = len(grid[0])
for y in range(height):
    row = []
    for x in range(width):
        cell = dict()
        if x == 0:
            cell["cell"] = y+1
        else:
            cell["cell"] = "0"
        bars = ''
        if x < width-1:
            if grid[y][x+1] != grid[y][x]:
                bars += 'R'
        if y < height-1:
            if grid[y+1][x] != grid[y][x]:
                bars += 'B'
        if bars:
            cell["style"] = {"barred": bars}
        row.append(cell)
    puzzle.append(row)
pz = json.dumps(puzzle)

#%% 
ipuz = dict()
ipuz['copyright'] = _copyright
ipuz['author'] = author
ipuz['title'] = title
ipuz['kind'] = ["http://ipuz.org/crossword#1"]
ipuz['version'] = "http://ipuz.org/v2"
ipuz['empty'] = '0'
ipuz['puzzle'] = puzzle
ipuz['block'] = '#'
ipuz['dimensions'] = {'width': len(grid[0]), 'height': len(grid)}
ipuz['fakeclues'] = True
ipuz['clues'] = clues

with open(OUTFILE, 'w') as fid:
    json.dump(ipuz, fid, indent=2)
