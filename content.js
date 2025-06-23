function log(message) {
  // Adding a unique prefix to easily filter logs in the console
  console.log(`%c[Board Flipper]%c ${message}`, 'color: #7e57c2; font-weight: bold;', 'color: default;');
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function flipBoardIfNeeded() {
  log('Running check to see if board needs flipping...');

  browser.storage.local.get('isFlipped').then(data => {
    const shouldBeFlipped = data.isFlipped || false;
    log(`Popup toggle is set to: ${shouldBeFlipped ? 'ON' : 'OFF'}.`);

    const board = document.querySelector('.board');
    const flipButton = document.getElementById('board-controls-flip');

    if (!board || !flipButton) {
      log('Board or flip button not found. Will re-check on next DOM change.');
      return;
    }

    const isActuallyFlipped = board.classList.contains('flipped');
    log(`Board's current state is: ${isActuallyFlipped ? 'Flipped' : 'Not Flipped'}.`);

    if (shouldBeFlipped !== isActuallyFlipped) {
      log(`State mismatch detected. Desired: ${shouldBeFlipped ? 'Flipped' : 'Not Flipped'}, Actual: ${isActuallyFlipped ? 'Flipped' : 'Not Flipped'}. Clicking the flip button.`);
      flipButton.click();
    } else {
      log('Board is already in the correct state. No action needed.');
    }
  });
}

// Debounce the function to prevent it from running too frequently during DOM updates.
const debouncedFlipCheck = debounce(flipBoardIfNeeded, 300);

log('Initializing Board Flipper content script.');

// Create a MutationObserver to watch for DOM changes, which indicate a new puzzle.
const observer = new MutationObserver((mutations) => {
  log(`DOM change detected. Scheduling a board check.`);
  debouncedFlipCheck();
});

// Start observing the body for changes in the element tree.
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Listen for changes from the popup toggle.
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.isFlipped) {
    log('Popup toggle state changed. Forcing an immediate board check.');
    // Run immediately, not debounced, for responsiveness.
    flipBoardIfNeeded();
  }
});

// Run an initial check when the script loads.
log('Performing initial board check.');
debouncedFlipCheck(); 