# -*- coding: utf-8 -*-
"""
Created on Mon Sep 16 21:18:05 2024

@author: Alex Boisvert
"""

from mip import Model, xsum, BINARY
import make_hex_graph as mhg
import make_hex_vpuz as mhv
import random
import networkx as nx
import json
import subprocess
import func_timeout
import time

# Time we give to Qxw
TIMEOUT_TIME = 30

def find_all_simple_paths(graph, min_len=6, max_len=15):
    """Find all simple paths within the length constraints."""
    paths = []
    graph_nodes = graph.nodes()
    for node in graph_nodes:
        for target in graph_nodes:
            if node != target:
                try:
                    this_list = list(nx.all_simple_paths(graph, source=node, target=target, cutoff=max_len))
                    paths.extend(this_list)
                except nx.NetworkXNoPath:
                    continue
    # Filter out paths that are too short
    ret = [path for path in paths if len(path) >= min_len]
    random.shuffle(ret)
    return ret

def run_qxw(filename, timeout=TIMEOUT_TIME):
    command = ["C:\\Program Files (x86)\\Qxw\\Qxw.exe", "-b", filename]
    try:
        # Use func_timeout to run the external command with a timeout
        result = func_timeout.func_timeout(timeout, subprocess.run, args=(command,), kwargs={
            "stdout": subprocess.PIPE,
            "stderr": subprocess.PIPE,
            "check": True,
            "text": True
        })
        
        # If the process completes successfully, return True along with the output
        return True, result.stdout, result.stderr
    except func_timeout.FunctionTimedOut:
        print(f"Command timed out after {timeout} seconds")
        return False, None, None
    except subprocess.CalledProcessError as e:
        #print(f"Command failed with error: {e}")
        return False, e.stdout, e.stderr

#%% Create G and find paths
G = mhg.create_hex_graph()
# Finding paths is slow
all_paths = find_all_simple_paths(G, min_len=5, max_len=12)

#%% Helper functions to set up the optimization problem and run Qxw

def create_pathfinder(G, paths, min_paths=28, max_paths=32, total_paths=50000):
    """
    Return a list of paths that satisfy the pathfinder requirements
    * No path self-intersects
    * Each hex (node) is contained in two paths
    """
    # List of tuples
    T = list(G.nodes())  # Your list of tuples
    
    # List of paths (each path is a list of tuples)
    # We take a subset to speed up the optimization
    random.shuffle(paths)
    P = paths[:total_paths]  # Your list of paths
    
    # Define the lengths of each path
    #path_lengths = [len(path) for path in P]
    
    # Initialize MIP model
    m = Model()
    m.verbose = 0
    
    # Create binary variables for each path
    x = [m.add_var(var_type=BINARY) for _ in P]
    
    # Add constraints: each tuple should appear in exactly two selected paths
    for t in T:
        m += xsum(x[i] for i, path in enumerate(P) if t in path) == 2
    
    # Add constraints for paths of specific lengths
    # Example: two paths of length 11
    #m += xsum(x[i] for i in range(len(P)) if path_lengths[i] == 11) >= 2
    
    # Example: one path of length 12, 13
    #m += xsum(x[i] for i in range(len(P)) if path_lengths[i] == 13) == 1
    
    # Add constraints on the number of paths
    m += xsum(x) >= min_paths
    m += xsum(x) <= max_paths
    
    # (Optional) Set an objective function, e.g., minimize the number of selected paths
    #m.objective = xsum(x)
    # Maximize the spread in path lengths
    #m.objective = -xsum(((path_lengths[i] - 9) ** 2) * x[i] for i in range(len(P)))
    
    # Run the optimization
    m.optimize()
    
    # Extract the selected paths
    selected_paths = [P[i] for i in range(len(P)) if x[i].x >= 0.99]
    return selected_paths

def make_qxd_file(selected_paths, filename="hex.qxd", wordlist="stwl_no_plurals.txt", words = {}):
    """
    Given selected paths, make a file for QXw to process
    """
    # Sort "selected paths" from top to bottom
    selected_paths = sorted(selected_paths, key=lambda x: (x[0][0], x[0][1]))

    qxd = f'''.DICTIONARY 1 {wordlist}
.USEDICTIONARY 1
.RANDOM 1
'''

    for i, path in enumerate(selected_paths):
        mystr = ''
        for v1 in path:
            x1, x2 = map(lambda x:str(x).zfill(2), v1)
            mystr += f"{x1}_{x2} "
        mystr = mystr[:-1]
        if words.get(i):
            mystr += f" ={words[i]}"
        mystr += '\n'
        qxd += mystr

    with open(filename, "w") as fid:
        fid.write(qxd)
        
    return filename

#%% Find paths and run Qxw
loop_count = 0
while True:
    loop_count += 1
    
    print(f"Running loop {loop_count}")
    
    # Find some paths
    print("Building paths ...")
    selected_paths = create_pathfinder(G, all_paths, min_paths=35, max_paths=36)
    
    # Write a qxd file
    filename = make_qxd_file(selected_paths)
    
    # Run the external command
    print("Running Qxw ...")
    success, stdout, stderr = run_qxw(filename, timeout=30)
    
    if success:
        print("Qxw completed successfully!")
        print(f"stdout:\n{stdout}")
        print(f"stderr:\n{stderr}")
        break
    else:
        print("Qxw did not find fill, retrying...")
        print()
        #if stdout:
        #    print(f"stdout:\n{stdout}")
        #if stderr:
        #    print(f"stderr:\n{stderr}")
    
    # Optional delay between retries
    #time.sleep(1)
    
# keep a copy just in case
stdout_orig = stdout
    
#%% Go back and improve the fill
words = {}

# Write a qxd file
filename = make_qxd_file(selected_paths, words=words)

# Run the external command
print("Running Qxw ...")
success, stdout, stderr = run_qxw(filename, timeout=300)
if success:
    print(stdout)
else:
    print("Could not find fill")

#%% Check for dupes
# Convert string to array
qxw_arr = stdout.strip().split('\n')

# Extract words
words = []
for line in qxw_arr:
    if line.startswith('# '):
        words.append(line[2:])
        
DUPE_LENGTH = 4
dupe_dict = dict()
for w in words:
    for i in range(len(w) - DUPE_LENGTH + 1):
        w1 = w[i:i+DUPE_LENGTH]
        dupe_dict[w1] = dupe_dict.get(w1, set()) | set([w])

for k, v in dupe_dict.items():
    if len(v) > 1:
        print(k, v)


#%% Turn this into vpuz files
qxw_out = stdout

reg_vpuz = mhv.make_vpuz(qxw_out, selected_paths, harder=False)
harder_vpuz = mhv.make_vpuz(qxw_out, selected_paths, harder=True)

with open('reg.vpuz', 'w') as fid:
    json.dump(reg_vpuz, fid, indent=2)

with open('harder.vpuz', 'w') as fid:
    json.dump(harder_vpuz, fid, indent=2)
