/**
 * Acrostic Options Modal
 * Controls len_distance, min_score, and custom word list upload.
 */

(function () {
  'use strict';

  // Global solver options shared with acrostic.js
  window.solverOptions = window.solverOptions || {
    lenDistance: 3,
    minScore: 50,
    wordlistName: 'Default (Spread The Wordlist)',
    isCustom: false
  };

  function closeModalBox() {
    const modal = document.getElementById('cw-modal');
    if (modal) modal.style.display = 'none';
  }

  function createModalBox(title, content, buttonText = 'Close') {
    const modalContent = `
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <span class="modal-close" id="modal-close">&times;</span>
      </div>
      <div class="modal-body">
        ${content}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" id="modal-button">${buttonText}</button>
      </div>
    </div>`;

    const modal = document.getElementById('cw-modal');
    modal.innerHTML = modalContent;
    modal.style.display = 'block';

    document.getElementById('modal-close').onclick = closeModalBox;
    document.getElementById('modal-button').onclick = closeModalBox;

    window.onclick = function (event) {
      if (event.target === modal) {
        closeModalBox();
      }
    };
  }

  function processWordList(fileContents, minScore) {
    const lines = fileContents.trim().replace(/\r/g, '').split('\n');
    const validLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(';');
      if (parts.length === 2) {
        const score = parseFloat(parts[1]);
        if (!isNaN(score) && score >= minScore) {
          validLines.push(line);
        }
      } else if (parts.length === 1 && line.length > 0) {
        // Line without score; assign 100
        validLines.push(`${line};100`);
      }
    }

    validLines.sort((a, b) => a.length - b.length || a.localeCompare(b));
    return validLines.join('\n');
  }

  function openOptionsModal() {
    const opts = window.solverOptions;
    const title = 'Solver Options';

    const html = `
      <label for="len-distance-input">Length distance (allowed deviation from mean length):</label>
      <input type="number" id="len-distance-input" min="1" max="10" step="1" value="${opts.lenDistance}" />

      <label for="min-score-input">Minimum word score (0 - 100):</label>
      <input type="number" id="min-score-input" min="0" max="100" step="1" value="${opts.minScore}" />

      <label for="wordlist-file-input">Word list:</label>
      <div id="wordlist-status" style="margin-bottom: 8px; font-size: 0.85em; color: #444;">
        Active: <strong>${opts.wordlistName}</strong>
        ${opts.isCustom ? ' • <a href="#" id="reset-wordlist-link">Reset to default</a>' : ''}
      </div>
      <input type="file" id="wordlist-file-input" accept=".txt,.dict" />

      <button type="button" class="button-primary" id="save-options-btn" style="margin-top: 15px;">Save Options</button>
    `;

    createModalBox(title, html, 'Cancel');

    // Reset link handler
    const resetLink = document.getElementById('reset-wordlist-link');
    if (resetLink) {
      resetLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof window.resetDefaultWordlist === 'function') {
          window.resetDefaultWordlist();
          opts.wordlistName = 'Default (Spread The Wordlist)';
          opts.isCustom = false;
          const statusEl = document.getElementById('wordlist-status');
          if (statusEl) {
            statusEl.innerHTML = `Active: <strong>${opts.wordlistName}</strong>`;
          }
        }
      });
    }

    // Save button handler
    document.getElementById('save-options-btn').addEventListener('click', () => {
      const lenInput = document.getElementById('len-distance-input');
      const scoreInput = document.getElementById('min-score-input');
      const fileInput = document.getElementById('wordlist-file-input');

      const newLen = parseInt(lenInput.value, 10);
      if (!isNaN(newLen) && newLen >= 1) {
        opts.lenDistance = newLen;
      }

      const newScore = parseInt(scoreInput.value, 10);
      if (!isNaN(newScore)) {
        opts.minScore = newScore;
      }

      // Check if a new file was uploaded
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = function (e) {
          const contents = e.target.result;
          const processed = processWordList(contents, opts.minScore);
          if (typeof window.setCustomWordlist === 'function') {
            window.setCustomWordlist(processed);
            opts.wordlistName = `${file.name} (${processed.split('\n').length} words)`;
            opts.isCustom = true;
          }
          closeModalBox();
        };

        reader.onerror = function () {
          alert('Failed to read file.');
          closeModalBox();
        };

        reader.readAsText(file);
      } else {
        closeModalBox();
      }
    });
  }

  const optionsBtn = document.getElementById('options-button');
  if (optionsBtn) {
    optionsBtn.addEventListener('click', openOptionsModal);
  }
})();
