let isFlipping = false;

// Tries to find the board element, which can have different class names.
function getBoardElement() {
  return document.querySelector('.board') || document.getElementById('board-layout-chessboard');
}

function flipBoardIfNeeded() {
  console.log('[Chess Flipper] Flip Check: Starting...');
  if (isFlipping) {
    console.log('[Chess Flipper] Flip Check: Aborted (already flipping).');
    return;
  }

  // The button that programmatically flips the board.
  const flipButton = document.getElementById('board-controls-flip');
  const board = getBoardElement();

  if (!flipButton || !board) {
    console.log('[Chess Flipper] Flip Check: Aborted (board or button not found).');
    return;
  }

  isFlipping = true;
  console.log('[Chess Flipper] Flip Check: Lock acquired.');

  chrome.storage.local.get('isFlipped').then(data => {
    const shouldBeFlipped = data.isFlipped || false;
    const isActuallyFlipped = board.classList.contains('flipped');
    console.log(`[Chess Flipper] Flip Check: Should be flipped? ${shouldBeFlipped}. Is it actually flipped? ${isActuallyFlipped}.`);

    if (shouldBeFlipped !== isActuallyFlipped) {
      console.log('[Chess Flipper] Flip Check: Mismatch detected. Clicking flip button.');
      flipButton.click();
    } else {
      console.log('[Chess Flipper] Flip Check: Board is in the correct state.');
    }
  });

  setTimeout(() => {
    isFlipping = false;
    console.log('[Chess Flipper] Flip Check: Lock released.');
  }, 500);
}

// Sets up an observer to watch for text changes in the turn indicator.
// This is how we know a new puzzle has loaded.
function observeTurnIndicator(turnIndicatorNode) {
  console.log('[Chess Flipper] Observer: Now watching turn indicator.', turnIndicatorNode);
  const observer = new MutationObserver(() => {
    const newText = turnIndicatorNode.innerText.trim();
    console.log(`[Chess Flipper] Observer: Turn indicator text changed to "${newText}".`);

    if (newText.includes('to Move')) {
      console.log('[Chess Flipper] Observer: "to Move" detected. Triggering flip check.');
      flipBoardIfNeeded();
    } else {
      console.log('[Chess Flipper] Observer: Text is not a turn indicator (e.g., "Correct"). Ignoring.');
    }
  });

  observer.observe(turnIndicatorNode, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Initial check in case the script loads after the indicator is already there
  if (turnIndicatorNode.innerText.trim().includes('to Move')) {
    console.log('[Chess Flipper] Observer: Initial check found a turn indicator. Triggering flip check.');
    flipBoardIfNeeded();
  }
}

function run() {
  console.log('[Chess Flipper] Content script loaded.');

  // This selector targets the element that says "White to Move" or "Black to Move".
  const turnIndicatorSelector = 'span.section-heading-title.section-heading-normal';

  // This observer waits for the turn indicator element to appear in the DOM.
  const elementFinderObserver = new MutationObserver((mutations, observer) => {
    const turnIndicatorNode = document.querySelector(turnIndicatorSelector);
    if (turnIndicatorNode) {
      console.log('[Chess Flipper] Observer: Found turn indicator element.');
      observer.disconnect();
      observeTurnIndicator(turnIndicatorNode);
    }
  });

  elementFinderObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.isFlipped) {
      console.log('[Chess Flipper] Observer: Storage change detected from popup.');
      flipBoardIfNeeded();
    }
  });
}

run(); 