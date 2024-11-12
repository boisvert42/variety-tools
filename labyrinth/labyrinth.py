# -*- coding: utf-8 -*-
"""
Created on Sat Nov  9 19:22:39 2024

@author: boisv
"""

import trie
import wordninja
from nltk.stem import PorterStemmer
from collections import Counter, deque
import itertools
import os
import numpy as np
from copy import deepcopy

stemmer = PorterStemmer()

MAX_WORD_LENGTH = 15
MIN_WORD_LENGTH = 4

prefixTrie = trie.Trie()
suffixTrie = trie.Trie()

words = set()
wordlist = r'spreadthewordlist.dict'
wordlist_path = os.path.join('..', 'word_lists', wordlist)
with open(wordlist_path, 'r') as fid:
    for line in fid:
        word, score = line.strip().upper().split(';')
        if int(score) >= 50 and len(word) >= MIN_WORD_LENGTH and len(word) <= MAX_WORD_LENGTH:
            words.add(word)
            prefixTrie.insert(word)
            suffixTrie.insert(word[::-1])
            
#%%


labyrinth_words = []


path = [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [3, 2], [2, 2], [2, 1], [2, 0], [3, 0], [3, 1], [4, 1], [4, 0], [5, 0], [5, 1], [6, 1], [6, 0], [7, 0], [7, 1], [8, 1], [8, 0], [9, 0], [9, 1], [9, 2], [8, 2], [8, 3], [9, 3], [10, 3], [10, 2], [10, 1], [10, 0], [11, 0], [11, 1], [11, 2], [11, 3], [11, 4], [10, 4], [9, 4], [9, 5], [10, 5], [11, 5], [11, 6], [10, 6], [9, 6], [8, 6], [8, 5], [8, 4], [7, 4], [7, 3], [7, 2], [6, 2], [6, 3], [6, 4], [6, 5], [7, 5], [7, 6], [6, 6], [6, 7], [7, 7], [7, 8], [6, 8], [6, 9], [6, 10], [6, 11], [7, 11], [7, 10], [7, 9], [8, 9], [8, 8], [8, 7], [9, 7], [10, 7], [11, 7], [11, 8], [10, 8], [9, 8], [9, 9], [10, 9], [11, 9], [11, 10], [11, 11], [11, 12], [11, 13], [10, 13], [10, 12], [10, 11], [10, 10], [9, 10], [8, 10], [8, 11], [9, 11], [9, 12], [9, 13], [8, 13], [8, 12], [7, 12], [7, 13], [6, 13], [6, 12], [5, 12], [5, 13], [4, 13], [4, 12], [3, 12], [3, 13], [2, 13], [2, 12], [2, 11], [3, 11], [3, 10], [2, 10], [1, 10], [1, 11], [1, 12], [1, 13], [0, 13], [0, 12], [0, 11], [0, 10], [0, 9], [1, 9], [2, 9], [2, 8], [1, 8], [0, 8], [0, 7], [1, 7], [2, 7], [3, 7], [3, 8], [3, 9], [4, 9], [4, 10], [4, 11], [5, 11], [5, 10], [5, 9], [5, 8], [4, 8], [4, 7], [5, 7], [5, 6], [4, 6], [4, 5], [5, 5], [5, 4], [5, 3], [5, 2], [4, 2], [4, 3], [4, 4], [3, 4], [3, 5], [3, 6], [2, 6], [1, 6], [0, 6], [0, 5], [1, 5], [2, 5], [2, 4], [1, 4], [0, 4], [0, 3], [0, 2], [0, 1]]

seed_entry = 'THESEUS'

labyrinth_words.append(seed_entry)

def safe_get(s, index, default='.'):
    '''
    get the character at the index, unless it doesn't exist, then return the default
    '''
    if 0 <= index < len(s):
        return s[index]
    else:
        return default

class Labyrinth:
    def __init__(self, path, seed_entry=None):
        self.ROWS = 14
        self.COLUMNS = 12
        self.path = path
        self.reset_grid()
        if seed_entry:
            seed_entry = seed_entry.upper()
            self.set_seed_entry(seed_entry)
            
    def set_seed_entry(self, seed_entry):
        self.reset_grid()
        self.labyrinth_words.append(seed_entry)
        self.seed_entry = seed_entry
            
    def reset_grid(self):
        self.labyrinth_words = deque()
        self.row_entries = [['', ''] for _ in range(self.ROWS)]
            
    def __repr__(self):
        return self.display_labyrinth()
    
    def grid(self):
        g = np.full((self.COLUMNS, self.ROWS), '.')
        labyrinth_string = ''.join(self.labyrinth_words)
        # find the index of the seed entry
        se_ix = labyrinth_string.index(self.seed_entry)
        ls0, ls1 = labyrinth_string[:se_ix], labyrinth_string[se_ix:]
        for i, let in enumerate(ls1):  
            rc = path[i]
            g[rc[1]][rc[0]] = let
        for i, let in enumerate(ls0[::-1]):  
            rc = path[-i-1]
            g[rc[1]][rc[0]] = let
        return g
            
    def display_labyrinth(self):
        """A basic visual representation of the grid to this point"""
        ret = ''
        for row in self.grid():
            for char in row:
                ret += f"{str(char)} "
            ret += "\n"
        return ret
    
    def get_row(self, row_index):
        """
        Get an array of the letters in a row
        """
        g = self.grid()
        return g[row_index]
        
    def add_labyrinth_word(self, word, pos='right'):
        if pos == 'right':
            self.labyrinth_words.append(word)
        else:
            self.labyrinth_words.appendleft(word)
        
    def remove_labyrinth_word(self, pos='right'):
        if pos == 'right':
            self.labyrinth_words.pop()
        else:
            self.labyrinth_words.popleft()
        
    def does_word_work(self, word, pos='right'):
        """
        Test that a new labyrinth entry wouldn't break anything
        """
        # Put the word in the labyrinth
        self.add_labyrinth_word(word, pos=pos)
        # Check that all the rows still work
        
        grid = self.grid()
        for row, arr in enumerate(grid):
            # If this arr is all periods, continue
            if len(set(arr)) == 1:
                continue
            # Assume we're always building left to right
            # if so we just have to check if the first half works
            # unless there's already a word in the first half
            
            # make a copy of the array
            arr1 = arr.copy()
            # if we've got a first entry, look past it
            find_first_entry = True
            if self.row_entries[row][0]:
                find_first_entry = False
                arr1 = arr[len(self.row_entries[row][0]):]
                if len(set(arr1)) == 1:
                    continue

            last_np_ix = np.where(arr1 != ".")[0][-1]
            lookup_str = ''.join(arr1[:last_np_ix+1])
            # If we're finding the first entry, we can have two cases
            # (a) we have a starting word. The rest has to be in the prefixTrie
            # (b) Our first letters aren't a word. Then the whole thing is a prefix.
            if find_first_entry and '.' not in lookup_str:
                for length in np.arange(len(lookup_str), MIN_WORD_LENGTH-1, -1):
                    if lookup_str[:length] not in words:
                        lookup_str = lookup_str[length:]
            if not prefixTrie.search(lookup_str):
                self.remove_labyrinth_word(pos=pos)
                return False
                
        self.remove_labyrinth_word(pos=pos)
        return True
    
    def add_row_word(self, word, row, index):
        """
        Add a word at the given row and index
        TODO: maybe add some verification?
        """
        self.row_entries[row][index] = word
        
    def next_labyrinth_words(self, pos='right'):
        arr = []
        for word in words:
            if self.does_word_work(word, pos=pos):
                arr.append(word)
        return arr
        
#END class

#%%
word, pos = 'KENNETHBRANAGH', 'left'
labyrinth.add_labyrinth_word(word, pos=pos)
for row, arr in enumerate(grid):
    # If this arr is all periods, continue
    if len(set(arr)) == 1:
        continue
    # Assume we're always building left to right
    # if so we just have to check if the first half works
    # unless there's already a word in the first half
    
    # make a copy of the array
    arr1 = arr.copy()
    # if we've got a first entry, look past it
    find_first_entry = True
    if labyrinth.row_entries[row][0]:
        find_first_entry = False
        arr1 = arr[len(labyrinth.row_entries[row][0]):]
        if len(set(arr1)) == 1:
            continue

    last_np_ix = np.where(arr1 != ".")[0][-1]
    lookup_str = ''.join(arr1[:last_np_ix+1])
    print(lookup_str)
    # If we're finding the first entry, we can have two cases
    # (a) we have a starting word. The rest has to be in the prefixTrie
    # (b) Our first letters aren't a word. Then the whole thing is a prefix.
    if find_first_entry and '.' not in lookup_str:
        for length in np.arange(len(lookup_str), MIN_WORD_LENGTH-1, -1):
            if lookup_str[:length] not in words:
                lookup_str = lookup_str[length:]
    if not prefixTrie.search(lookup_str):
        #labyrinth.remove_labyrinth_word(pos=pos)
        print(False)
        break
        
labyrinth.remove_labyrinth_word(pos=pos)
