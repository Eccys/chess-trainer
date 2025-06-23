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

let processedBoardElement = null;
let lastSetStateWasFlipped = false;

function flipBoardIfNeeded() {
  log('Running check...');

  const flipButton = document.getElementById('board-controls-flip');
  const currentBoard = document.querySelector('.board');

  if (!currentBoard || !flipButton) {
    log('Board or flip button not found. Will re-check on next DOM change.');
    return;
  }

  // If the board element on the page is different from the one we've processed,
  // it means a new puzzle has loaded.
  if (currentBoard !== processedBoardElement) {
    log('New board detected. Resetting internal flip state.');
    processedBoardElement = currentBoard;
    lastSetStateWasFlipped = false; // A new board always loads in the default (unflipped) state.
  }

  browser.storage.local.get('isFlipped').then(data => {
    const shouldBeFlipped = data.isFlipped || false;
    log(`Desired state: ${shouldBeFlipped ? 'Flipped' : 'Not Flipped'}. Internal state: ${lastSetStateWasFlipped ? 'Flipped' : 'Not Flipped'}.`);

    if (shouldBeFlipped !== lastSetStateWasFlipped) {
      log('State mismatch. Clicking the flip button to sync state.');
      flipButton.click();
      lastSetStateWasFlipped = shouldBeFlipped;
    } else {
      log('Board is already in the desired state. No action needed.');
    }
  });
}

// Debounce the function to prevent it from running too frequently during DOM updates.
const debouncedFlipCheck = debounce(flipBoardIfNeeded, 300);

log('Initializing Board Flipper content script.');

// Create a MutationObserver to watch for DOM changes, which indicate a new puzzle.
const observer = new MutationObserver(() => {
  // We don't need to inspect the mutations, any change could be a new puzzle.
  // The debounced function will handle checking efficiently.
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
    log('Popup toggle changed. Forcing an immediate check.');
    // Use the debounced function to avoid race conditions with other DOM changes.
    debouncedFlipCheck();
  }
});

// Run an initial check when the script loads.
log('Performing initial board check.');
debouncedFlipCheck(); 