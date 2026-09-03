/**
 * (c) 2024, Crossword Nexus
 * MIT License https://mit-license.org/
 **/

/**
 * Function that defines what to do when we load a puzzle
 **/
function loadPuzzle(data) {
  // All the interesting code here
  const img = document.getElementById('puzzle-image'); // Get the image element
  const canvas = document.getElementById('canvas'); // Get the canvas element
  const ctx = canvas.getContext('2d'); // Get the 2D drawing context for the canvas

  // Default variables
  let fontSize = 30; // font size -- should we make this configurable?
  const saveTime = 10000; // how long to keep the localStorage

  function resizeAndRedraw() {
    if (!img.clientWidth || !img.clientHeight) return;
    // Adjust the canvas size in the DOM to match the image
    canvas.style.width = img.clientWidth + 'px';
    canvas.style.height = img.clientHeight + 'px';

    // Clear and redraw letters
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    letters.forEach(letter => {
      if (data['multiple-letters']) {
        drawLetter(letter.x, letter.y, letter.letter, false, "left");
      }
      else {
        drawLetter(letter.x, letter.y, letter.letter, false);
      }
    });

    fitClueText();
  }

  /** Define what to do when the image loads **/
  img.onload = function() {
    // Set canvas dimensions to match the image dimensions
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Redraw when the window is resized
    window.addEventListener('resize', resizeAndRedraw);

    // Watch for image size changes (e.g. keyboard toggle, viewport changes)
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        resizeAndRedraw();
      });
      ro.observe(img);
    }

    // Initial draw
    resizeAndRedraw();
  }

  /** Replace the HTML with data from the file **/
  data = readVpuz(data);

  // Read clue notes and letters
  var letters = lscache.get(data.letters_save) || [];
  var clue_notes = lscache.get(data.clue_notes_save) || [];
  var clue_completed = lscache.get(data.clue_completed_save) || [];

  // Load the image
  img.src = data['puzzle-image'];

  // Set the page title
  if (data.title) {
    document.title = data.title + ' | ' + document.title;
  }

  /** Clues **/

  // If there are no clues, hide the clue panel and mobile clue bar
  if (data['improved-clues'].length === 0) {
    document.getElementById('clue-panels').style.display = 'none';
    const mb = document.getElementById('mobile-clue-bar');
    if (mb) mb.style.display = 'none';
  }

  // Change the width of the clue-numbers depending on size
  const clueNumberLengths = data['improved-clues'].map(x => x.clues).flat().map(x => x.number.length);
  const clueNumberWidth = 0.9 * Math.max(...clueNumberLengths);

  var sheet = document.styleSheets[0];
  var rule = `.clue-number { min-width: ${clueNumberWidth}rem }`;
  sheet.insertRule(rule, sheet.cssRules.length);

  // Loop through clues and add to DOM
  var clueHTML = '', clueBoxId = 0;
  for (var i = 0; i < data['improved-clues'].length; i++) {
    // Add a clue panel
    clueHTML += `<div id="clues-${i}" class="clue-panel">\n`;
    // Add a title
    clueHTML += `  <h2 id="clues-${i}-title" class="clues-title">${data['improved-clues'][i].title}</h2>`;
    // Add a clue list ul
    clueHTML += `<ul class="clue-list" id="clue-list-${i}">`;
    // Add the list elements
    var thisHTML = '';
    data['improved-clues'][i].clues.forEach(obj => {
      const isCompleted = clue_completed[clueBoxId];
      thisHTML += `
          <li class="clue-item${isCompleted ? ' completed' : ''}" data-clue-id="${clueBoxId}">
            <span class="clue-number">${obj.number}</span>
            <span class="clue-text">${obj.text}
            <input class="input-box note-style" id="clue-box-${clueBoxId}" type="text">
            </span>
            <span class="cluenote-button" style="display: none;"></span>`
      if (obj.explanation) thisHTML += `<span class="clue-explanation">${obj.explanation}</span>\n`;
      thisHTML += "</li>\n";
      clueBoxId += 1;
    });
    clueHTML += thisHTML;
    // Close all the tags
    clueHTML += "</ul></div>\n";
  }
  // Add this HTML to the DOM
  document.getElementById("clue-panels").innerHTML = clueHTML;

  // Load clue notes if applicable
  for (var cnix = 0; cnix < clue_notes.length; cnix++) {
    var thisNote = clue_notes[cnix];
    if (thisNote) {
      var thisBox = document.getElementById(`clue-box-${cnix}`);
      thisBox.value = thisNote;
      thisBox.style.display = 'block';
    }
  }

  /** Mobile Clue Bar setup **/
  const flatClues = [];
  let flatClueId = 0;
  for (var i = 0; i < data['improved-clues'].length; i++) {
    const sectionTitle = data['improved-clues'][i].title || '';
    data['improved-clues'][i].clues.forEach(obj => {
      flatClues.push({
        id: flatClueId,
        sectionIndex: i,
        direction: sectionTitle,
        number: obj.number,
        text: obj.text,
        explanation: obj.explanation
      });
      flatClueId++;
    });
  }

  let currentClueIndex = 0;
  const mobileClueBar = document.getElementById('mobile-clue-bar');
  const mobileClueContent = document.getElementById('mobile-clue-content');
  const mobileClueHeader = document.getElementById('mobile-clue-header');
  const mobileClueText = document.getElementById('mobile-clue-text');
  const prevButton = document.getElementById('mobile-prev-clue');
  const nextButton = document.getElementById('mobile-next-clue');

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function updateMobileClue() {
    if (!flatClues || flatClues.length === 0) {
      if (mobileClueBar) mobileClueBar.style.display = 'none';
      return;
    }
    const clue = flatClues[currentClueIndex];

    const isSingleList = data['improved-clues'].length <= 1;
    const num = (clue.number && clue.number !== '•') ? clue.number.trim() : '';
    const dir = (!isSingleList && clue.direction) ? clue.direction.trim() : '';
    let headerText = '';
    if (num && dir) {
      headerText = `${num} ${dir}`;
    } else if (num) {
      headerText = num;
    } else if (dir) {
      headerText = dir;
    }
    if (mobileClueHeader) {
      mobileClueHeader.textContent = headerText;
      mobileClueHeader.style.display = headerText ? 'block' : 'none';
    }

    let clueHtml = clue.text || '';
    if (clue.explanation) {
      clueHtml += ` <span class="clue-explanation">${clue.explanation}</span>`;
    }
    if (clue_notes[clue.id]) {
      clueHtml += ` <div class="mobile-clue-note">Note: ${escapeHtml(clue_notes[clue.id])}</div>`;
    }
    if (mobileClueText) mobileClueText.innerHTML = clueHtml;

    if (mobileClueContent) {
      const isCompleted = !!clue_completed[clue.id];
      mobileClueContent.classList.toggle('completed', isCompleted);
    }

    fitClueText();
  }

  function fitClueText() {
    if (!mobileClueContent || !mobileClueText) return;
    const maxFontSize = 17;
    const minFontSize = 10;

    const containerHeight = mobileClueContent.clientHeight;
    if (containerHeight === 0) {
      mobileClueText.style.fontSize = maxFontSize + 'px';
      mobileClueText.style.overflowY = 'hidden';
      return;
    }

    let headerHeight = 0;
    if (mobileClueHeader && mobileClueHeader.style.display !== 'none' && mobileClueHeader.textContent.trim() !== '') {
      headerHeight = mobileClueHeader.offsetHeight;
      const headerStyle = window.getComputedStyle(mobileClueHeader);
      headerHeight += (parseFloat(headerStyle.marginTop) || 0) + (parseFloat(headerStyle.marginBottom) || 0);
    }

    // Available height for clue text with 3px clearance for font descenders
    const availableHeight = containerHeight - headerHeight - 3;

    let size = maxFontSize;
    mobileClueText.style.fontSize = size + 'px';
    mobileClueText.style.overflowY = 'hidden';

    // Step down font size until clue text height fits within available height
    while (
      mobileClueText.scrollHeight > availableHeight &&
      size > minFontSize
    ) {
      size--;
      mobileClueText.style.fontSize = size + 'px';
    }

    if (mobileClueText.scrollHeight > availableHeight) {
      mobileClueText.style.overflowY = 'auto';
      mobileClueText.style.maxHeight = availableHeight + 'px';
    } else {
      mobileClueText.style.overflowY = 'hidden';
      mobileClueText.style.maxHeight = '';
    }
  }

  window.addEventListener('resize', fitClueText);

  function prevClue() {
    if (flatClues.length === 0) return;
    currentClueIndex = (currentClueIndex - 1 + flatClues.length) % flatClues.length;
    updateMobileClue();
  }

  function nextClue() {
    if (flatClues.length === 0) return;
    currentClueIndex = (currentClueIndex + 1) % flatClues.length;
    updateMobileClue();
  }

  if (prevButton) {
    prevButton.addEventListener('click', function(e) {
      e.stopPropagation();
      prevClue();
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', function(e) {
      e.stopPropagation();
      nextClue();
    });
  }

  if (mobileClueContent) {
    mobileClueContent.addEventListener('click', function() {
      if (flatClues.length === 0) return;
      const clue = flatClues[currentClueIndex];
      clue_completed[clue.id] = !clue_completed[clue.id];
      lscache.set(data.clue_completed_save, clue_completed, saveTime);
      updateMobileClue();

      // Sync with desktop clue list
      const desktopItem = document.querySelector(`.clue-item[data-clue-id="${clue.id}"]`);
      if (desktopItem) {
        desktopItem.classList.toggle('completed', clue_completed[clue.id]);
      }
    });
  }

  if (mobileClueBar) {
    let touchStartX = 0;
    let touchStartY = 0;
    mobileClueBar.addEventListener('touchstart', function(e) {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    mobileClueBar.addEventListener('touchend', function(e) {
      const touchEndX = e.changedTouches[0].screenX;
      const touchEndY = e.changedTouches[0].screenY;
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;
      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          nextClue();
        } else {
          prevClue();
        }
      }
    }, { passive: true });
  }

  // Initial display of mobile clue
  updateMobileClue();

  /** Now for the puzzle functionality **/
  // Create and style the overlay and circle elements
  const overlay = document.createElement('div');
  const circle = document.createElement('div');
  overlay.id = 'overlay';
  circle.id = 'circle';
  overlay.appendChild(circle);
  document.body.appendChild(overlay); // Append overlay to the body

  let clickX, clickY; // Variables to store click coordinates
  //letters = lscache.get(data.letters_save) || []; // Array to store letters and their positions

  // Event listener for canvas clicks
  document.getElementById('canvas').addEventListener('click', function(event) {
    const rect = canvas.getBoundingClientRect(); // Get canvas bounding rectangle
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    clickX = (event.clientX - rect.left) * scaleX; // Calculate click's X coordinate relative to the canvas
    clickY = (event.clientY - rect.top) * scaleY; // Calculate click's Y coordinate relative to the canvas

    // Explicit dimensions for the circle
    const circleDiameter = fontSize * 1.5 * (rect.width / canvas.width);
    circle.style.width = circleDiameter + 'px';
    circle.style.height = circleDiameter + 'px';

    // Calculate circle's position relative to the overlay
    const circleX = event.clientX - circleDiameter / 2;
    const circleY = event.clientY - circleDiameter / 2;

    // Position the circle around the clicked area
    circle.style.transform = `translate(${circleX}px, ${circleY}px)`;
    overlay.style.display = 'flex'; // Show the overlay
    overlay.style.pointerEvents = 'auto'; // Enable pointer events for the overlay

    // If we're looking for multiple letters, handle that
    if (data['multiple-letters']) {
      const input = prompt("Enter letters:");
      if (input) {
        let nextX = clickX, nextY = clickY;
        for (const letter of input.toUpperCase()) {
          textWidth = drawLetter(nextX, nextY, letter, align="left", family="monospace");
          nextX += textWidth + 2;
        }
      } else {
        // if no input, try to delete the text that's there
        removeLetter(clickX, clickY, xRadius=5);
      }
      overlay.style.display = 'none'; // Hide the overlay
    }
    else {
      // Add a keydown event listener to capture user input
      document.addEventListener('keydown', handleKeydown);
    }
  });

  // Event listener to hide the overlay on click
  overlay.addEventListener('click', function() {
    overlay.style.display = 'none'; // Hide the overlay
    document.removeEventListener('keydown', handleKeydown); // Remove the keydown event listener
    clickX = undefined;
    clickY = undefined;
  });

  // Function to handle keydown events
  function handleKeydown(event) {
    if (overlay.style.display === 'flex') { // Check if the overlay is displayed
      const letter = event.key; // Get the pressed key
      if (letter === 'Backspace' || letter === 'Delete') {
        removeLetter(clickX, clickY); // Remove letter if Backspace or Delete is pressed
      } else if (letter.length === 1 && letter.match(/[a-z\.\=\+]/i)) {
        drawLetter(clickX, clickY, letter); // Draw the letter on the canvas
      }
      overlay.style.display = 'none'; // Hide the overlay
      // Remove the keydown event listener
      document.removeEventListener('keydown', handleKeydown);
      clickX = undefined;
      clickY = undefined;
    }
  }

  /** Virtual Keyboard setup **/
  const vk = document.getElementById('virtual-keyboard');
  const vkShowBtn = document.getElementById('vk-show-button');

  // Check saved collapse state
  if (sessionStorage.getItem('cnvs_vk_hidden') === 'true') {
    if (vk) vk.classList.add('vk-hidden');
    document.body.classList.add('vk-collapsed');
  }

  // Connect virtual keyboard action callback
  window._cnvs_onVirtualKey = function(key, action) {
    if (action === 'hide') {
      if (vk) vk.classList.add('vk-hidden');
      document.body.classList.add('vk-collapsed');
      sessionStorage.setItem('cnvs_vk_hidden', 'true');
      resizeAndRedraw();
      setTimeout(resizeAndRedraw, 220);
      return;
    }

    if (overlay.style.display === 'flex' && clickX !== undefined && clickY !== undefined) {
      if (key === 'Backspace') {
        removeLetter(clickX, clickY);
      } else if (key) {
        drawLetter(clickX, clickY, key);
      }
      overlay.style.display = 'none';
      document.removeEventListener('keydown', handleKeydown);
      clickX = undefined;
      clickY = undefined;
    }
  };

  if (vk && !vk.dataset.initialized) {
    vk.dataset.initialized = 'true';
    let lastPointerTime = 0;
    vk.addEventListener('pointerdown', function(e) {
      const btn = e.target.closest('button');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      lastPointerTime = Date.now();
      if (typeof window._cnvs_onVirtualKey === 'function') {
        window._cnvs_onVirtualKey(btn.getAttribute('data-key'), btn.getAttribute('data-action'));
      }
    });

    vk.addEventListener('click', function(e) {
      const btn = e.target.closest('button');
      if (!btn) return;
      e.stopPropagation();
      if (Date.now() - lastPointerTime < 500) return;
      if (typeof window._cnvs_onVirtualKey === 'function') {
        window._cnvs_onVirtualKey(btn.getAttribute('data-key'), btn.getAttribute('data-action'));
      }
    });
  }

  if (vkShowBtn && !vkShowBtn.dataset.initialized) {
    vkShowBtn.dataset.initialized = 'true';
    vkShowBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (vk) vk.classList.remove('vk-hidden');
      document.body.classList.remove('vk-collapsed');
      sessionStorage.removeItem('cnvs_vk_hidden');
      resizeAndRedraw();
      setTimeout(resizeAndRedraw, 220);
    });
  }

  // Function to draw a letter centered at (x, y) on the canvas
  function drawLetter(x, y, letter, push = true, align="center", family="Arial") {
    console.log(family);
    ctx.font = `${fontSize}px ${family}`; // Set font size and family
    ctx.textBaseline = "middle";  // center vertical alignment
    ctx.textAlign = align; // horizontal alignment
    ctx.fillStyle = 'black'; // Set text color

    letter = letter.toUpperCase(); // I don't see a reason to allow lowercase

    // make a "+" if the user entered "./=/+"
    if (letter.match(/[\.\=\+]/)) letter = '+';

    const textWidth = ctx.measureText(letter).width; // Measure text width

    // Draw the text centered at (x, y)
    ctx.fillText(letter, x, y);

    // Store the letter and its position
    if (push) {
      letters.push({
        x,
        y,
        letter,
        width: textWidth,
        height: fontSize
      });
      lscache.set(data.letters_save, letters, saveTime);
    }

    // Confetti if needed
    checkIfSolved(data, letters);

    return textWidth;

  }

  // Function to remove a letter if clicked and backspace/delete is pressed
  function removeLetter(x, y, xRadius=1) {
    // Separate into letters to keep and letters to remove
    const kept = letters.filter(letter => {
      const withinX = Math.abs(letter.x - x) <= xRadius * letter.height / 2;
      const withinY = Math.abs(letter.y - y) < letter.height / 2;
      // Keep only those that do NOT match both conditions
      return !(withinX && withinY);
    });

    if (kept.length !== letters.length) {
      // Replace letters array contents
      letters.length = 0;
      letters.push(...kept);

      // Save updated list
      lscache.set(data.letters_save, letters, saveTime);

      // Clear and redraw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      letters.forEach(letter => {
        drawLetter(letter.x, letter.y, letter.letter, false);
      });
    }
  } // end removeLetter

  /** Dealing with clue note boxes and completed states **/
  // Select all .clue-item elements
  const items = document.querySelectorAll('.clue-item');

  // Function to save input-box text to localStorage
  function saveInputBoxText(inputBox) {
    var thisNum = parseInt(inputBox.id.split('-').at(-1))
    clue_notes[thisNum] = inputBox.value;
    lscache.set(data.clue_notes_save, clue_notes, saveTime);
    updateMobileClue();
  }

  // Function to check input box value and hide/show accordingly
  function checkInputBox(inputBox) {
    if (inputBox.value.trim() === '') {
      inputBox.style.display = 'none'; // Hide if input is empty
    } else {
      inputBox.style.display = 'block'; // Show if input is not empty
    }
  }

  // Loop through each item and add event listeners
  items.forEach(item => {
    let inputBox = item.querySelector('.input-box');
    let cluenoteButton = item.querySelector('.cluenote-button');
    let clueId = parseInt(item.getAttribute('data-clue-id'));

    // Hover state for showing the pencil icon
    item.addEventListener('mouseenter', function() {
      if (inputBox.value.trim().length === 0) {
        cluenoteButton.style.display = 'block';
      }
    });

    item.addEventListener('mouseleave', function() {
      cluenoteButton.style.display = 'none';
    });

    // Pencil button click to focus note input
    cluenoteButton.addEventListener('click', function(event) {
      event.stopPropagation();
      inputBox.style.display = 'block';
      inputBox.focus();
      cluenoteButton.style.display = 'none';
    });

    // Clicking the input box itself shouldn't toggle the clue completion
    inputBox.addEventListener('click', function(event) {
      event.stopPropagation();
    });

    // Add input event listener to check visibility
    inputBox.addEventListener('input', function(event) {
      checkInputBox(event.target);
      saveInputBoxText(event.target);
    });

    // Add blur event listener to hide the input box if it's empty
    inputBox.addEventListener('blur', function(event) {
      checkInputBox(event.target);
      saveInputBoxText(event.target);
    });

    // Clicking on the clue item grays it out (like fakeclues mode)
    item.addEventListener('click', function() {
      item.classList.toggle('completed');
      clue_completed[clueId] = item.classList.contains('completed');
      lscache.set(data.clue_completed_save, clue_completed, saveTime);
      currentClueIndex = clueId;
      updateMobileClue();
    });

    // Add keydown event listener to the input box
    inputBox.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        inputBox.blur(); // Remove focus when Enter is pressed
      }
    });

  });

  // Font size control (slider)
  const fontSlider = document.getElementById('font-slider');
  // Set initial slider value
  fontSlider.value = fontSize;

  fontSlider.addEventListener('input', function(event) {
    fontSize = parseInt(event.target.value);
    resizeAndRedraw();
  });

  // Show the modal when the info button is clicked
  document.getElementById('infoButton').addEventListener('click', function() {
    // Set the contents of the modal
    // Title
    var title = data.title;
    // Body
    var bodyHTML = '';
    if (data.author) bodyHTML += `<p id="modal-author">${data.author}</p>`;
    if (data.copyright) bodyHTML += `<p id="modal-copyright">${data.copyright}</p>`;
    if (data.notes) bodyHTML += `<p id="modal-notes">${data.notes}</p>`;
    bodyHTML += '<hr />';
    bodyHTML += `<p><strong>How to solve:</strong>
    Click on any blank space or cell in the grid to highlight it, then type a letter.
    Highlight and press <strong>Backspace</strong> or <strong>Delete</strong> to remove a letter.</p>`;
    // Show the modal
    showModal(title, bodyHTML);
  }); // end info

  // Create PDF when the print button is clicked
  document.getElementById('printButton').addEventListener('click', async function() {
    const vpuzObj = data;
    // add the image to options, and launch print dialog
    options_obj = {'image': data['puzzle-image'], 'print': true};

    if (data['notes']) {
      options_obj['show_notepad'] = true;
    }
    // add some fake iPuz data
    vpuzObj['kind'] = ["http://ipuz.org/crossword#1"];
    vpuzObj["dimensions"] = {"height": 3, "width": 3};
    vpuzObj["puzzle"] = [ ["#", "#", "#"], ["#", "#", "#"], ["#", "#", "#"] ];

    const xw_constructor = new JSCrossword();
    const xw = xw_constructor.fromIpuz(vpuzObj);
    try {
      const options = {};
      const doc = await xw.toPDF(options_obj);
      doc.autoPrint();
      // open in a new tab and trigger print dialog
      const blobUrl = doc.output("bloburl");
      window.open(blobUrl, "_blank");
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to create PDF. See console for details.");
    }
  });

} // end loadPuzzle

/** Generic modal functionality **/
function showModal(title, body) {
  // set the values
  document.getElementById('modal-title').innerHTML = title;
  document.getElementById('modal-body').innerHTML = body;
  // show the modal
  document.getElementById('infoModal').style.display = 'flex';
}

// Hide the modal when the close button is clicked
document.getElementById('closeModal').addEventListener('click', function() {
  document.getElementById('infoModal').style.display = 'none';
});

// Hide the modal when clicking outside the modal content
document.getElementById('infoModal').addEventListener('click', function(event) {
  if (event.target === infoModal) {
    document.getElementById('infoModal').style.display = 'none';
  }
});

/** vPuz parsing **/
function readVpuz(data) {

  // Get a hash of the data
  const dataHash = hashCode(JSON.stringify(data));

  // Get the hash of the data
  data['letters_save'] = `cnvs_letters_${dataHash}`;
  data['clue_notes_save'] = `cnvs_notes_${dataHash}`;
  data['clue_completed_save'] = `cnvs_completed_${dataHash}`;

  // If there's a "solution-string", add a sorted version
  if (data['solution-string']) {
    data['solution-string-sorted'] = sortString(data['solution-string']);
  }

  // If there's an "intro" but no notes, replace "notes" with "intro"
  if (data.intro && !data.notes) {
    data.notes = data.intro;
  }

  /** Standardize how the clues are presented **/
  const clues = [];

  // Iterate through the titles of the clues (if they exist)
  var titles = Object.keys(data['clues']) || {};

  titles.forEach(function(title) {
    var thisClues = [];
    data['clues'][title].forEach(function(clue) {
      var number = '•',
        text = '';
      explanation = null;
      // a "clue" can be an array or an object (or a string?)
      if (Array.isArray(clue)) {
        number = clue[0].toString();
        text = clue[1];
      } else if (typeof clue === 'string') {
        text = clue;
      } else { // object
        if (clue.number) {
          number = clue.number.toString();
        }
        text = clue.clue;
        explanation = clue.explanation;
      }
      var myObj = {
        'number': number,
        'text': text
      };
      if (explanation) myObj['explanation'] = explanation;
      thisClues.push(myObj);
    });
    clues.push({
      'title': title.split(':').at(-1),
      'clues': thisClues
    });
  });

  data['improved-clues'] = clues;
  return data;
}

// confetti code from https://gist.github.com/elrumo/3055a9163fd2d0d19f323db744b0a094
var confetti={maxCount:150,speed:2,frameInterval:15,alpha:1,gradient:!1,start:null,stop:null,toggle:null,pause:null,resume:null,togglePause:null,remove:null,isPaused:null,isRunning:null};!function(){confetti.start=s,confetti.stop=w,confetti.toggle=function(){e?w():s()},confetti.pause=u,confetti.resume=m,confetti.togglePause=function(){i?m():u()},confetti.isPaused=function(){return i},confetti.remove=function(){stop(),i=!1,a=[]},confetti.isRunning=function(){return e};var t=window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame,n=["rgba(30,144,255,","rgba(107,142,35,","rgba(255,215,0,","rgba(255,192,203,","rgba(106,90,205,","rgba(173,216,230,","rgba(238,130,238,","rgba(152,251,152,","rgba(70,130,180,","rgba(244,164,96,","rgba(210,105,30,","rgba(220,20,60,"],e=!1,i=!1,o=Date.now(),a=[],r=0,l=null;function d(t,e,i){return t.color=n[Math.random()*n.length|0]+(confetti.alpha+")"),t.color2=n[Math.random()*n.length|0]+(confetti.alpha+")"),t.x=Math.random()*e,t.y=Math.random()*i-i,t.diameter=10*Math.random()+5,t.tilt=10*Math.random()-10,t.tiltAngleIncrement=.07*Math.random()+.05,t.tiltAngle=Math.random()*Math.PI,t}function u(){i=!0}function m(){i=!1,c()}function c(){if(!i)if(0===a.length)l.clearRect(0,0,window.innerWidth,window.innerHeight),null;else{var n=Date.now(),u=n-o;(!t||u>confetti.frameInterval)&&(l.clearRect(0,0,window.innerWidth,window.innerHeight),function(){var t,n=window.innerWidth,i=window.innerHeight;r+=.01;for(var o=0;o<a.length;o++)t=a[o],!e&&t.y<-15?t.y=i+100:(t.tiltAngle+=t.tiltAngleIncrement,t.x+=Math.sin(r)-.5,t.y+=.5*(Math.cos(r)+t.diameter+confetti.speed),t.tilt=15*Math.sin(t.tiltAngle)),(t.x>n+20||t.x<-20||t.y>i)&&(e&&a.length<=confetti.maxCount?d(t,n,i):(a.splice(o,1),o--))}(),function(t){for(var n,e,i,o,r=0;r<a.length;r++){if(n=a[r],t.beginPath(),t.lineWidth=n.diameter,e=(i=n.x+n.tilt)+n.diameter/2,o=n.y+n.tilt+n.diameter/2,confetti.gradient){var l=t.createLinearGradient(e,n.y,i,o);l.addColorStop("0",n.color),l.addColorStop("1.0",n.color2),t.strokeStyle=l}else t.strokeStyle=n.color;t.moveTo(e,n.y),t.lineTo(i,o),t.stroke()}}(l),o=n-u%confetti.frameInterval),requestAnimationFrame(c)}}function s(t,n,o){var r=window.innerWidth,u=window.innerHeight;window.requestAnimationFrame=window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||function(t){return window.setTimeout(t,confetti.frameInterval)};var m=document.getElementById("confetti-canvas");null===m?((m=document.createElement("canvas")).setAttribute("id","confetti-canvas"),m.setAttribute("style","display:block;z-index:999999;pointer-events:none;position:fixed;top:0"),document.body.prepend(m),m.width=r,m.height=u,window.addEventListener("resize",(function(){m.width=window.innerWidth,m.height=window.innerHeight}),!0),l=m.getContext("2d")):null===l&&(l=m.getContext("2d"));var s=confetti.maxCount;if(n)if(o)if(n==o)s=a.length+o;else{if(n>o){var f=n;n=o,o=f}s=a.length+(Math.random()*(o-n)+n|0)}else s=a.length+n;else o&&(s=a.length+o);for(;a.length<s;)a.push(d({},r,u));e=!0,i=!1,c(),t&&window.setTimeout(w,t)}function w(){e=!1}}();


// helper function to sort a string
function sortString(s) {
  return s.split("").sort().join("");
}

// Check if solved
function checkIfSolved(data, letters) {
  // Grab the solution string
  const solutionString = data['solution-string-sorted'];

  // Clean up letters user has typed
  const userLetters = letters.map(item => item.letter);
  const userLettersString = userLetters.join('');
  const cleanedStr = userLettersString.replace(/[^A-Za-z]/g, "");

  // We don't need to go on if the letter counts are mismatched
  if (!solutionString || solutionString.length !== cleanedStr.length) {
    return;
  }

  // Sort the letters the user has typed
  const userLettersSorted = sortString(cleanedStr);

  // If they match, make some confetti
  if (solutionString == userLettersSorted) {
    confetti.start();
    setTimeout(function() {
      confetti.stop()
    }, 3000);

    // If there are clue explanations, show them
    document.querySelectorAll('.clue-explanation').forEach(elt => {
      elt.style.display = 'block';
    });

    // If there's an "explanation", open a modal box and show it
    if (data.explanation) {
      showModal('Explanation', data.explanation);
    }
  }
} // end checkIfSolved

/**
 * Functions for loading a puzzle from the user
 **/

// Clicking the button opens the file menu
const openVpuzButton = document.getElementById('open-vpuz-button');
const openVpuzInput = document.getElementById('open-vpuz-input');
openVpuzButton.addEventListener('click', function() {
  openVpuzInput.click();
});

/** Helper function to check if the browser has drag-and-drop capability **/
function supportsDragAndDrop() {
  var div = document.createElement('div');
  return ('draggable' in div) || ('ondragstart' in div && 'ondrop' in div);
}

/**
 * Simple hash function
 * via https://stackoverflow.com/a/8831937
 **/
function hashCode(str) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
}
