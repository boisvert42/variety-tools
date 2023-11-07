function make_fakeclues_puz(xw, preserve_words, sort_second_clues_only) {
  if (!preserve_words) {
    // Create new "words" from the grid
    var thisGrid = new xwGrid(xw.cells);
    var word_id = 1;
    var acrossEntries = thisGrid.acrossEntries();
    Object.keys(acrossEntries).forEach(function(i) {
        var thisWord = {'id': (word_id++).toString(), 'cells': acrossEntries[i]['cells'], 'dir': 'across'};
        words.push(thisWord);
    });
    var downEntries = thisGrid.downEntries();
    Object.keys(downEntries).forEach(function(i) {
        var thisWord = {'id': (word_id++).toString(), 'cells': downEntries[i]['cells'], 'dir': 'down'};
        words.push(thisWord);
    });
    xw.words = words;
  }
}
