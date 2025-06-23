let isFlipping = false;

function getBoardElement() {
  return document.querySelector('.board') || document.getElementById('board-layout-chessboard');
}

function flipBoardIfNeeded() {
  console.log('[Chess Trainer] Flip Check: Starting...');
  if (isFlipping) {
    console.log('[Chess Trainer] Flip Check: Aborted (already flipping).');
    return;
  }

  const flipButton = document.getElementById('board-controls-flip');
  const board = getBoardElement();

  if (!flipButton || !board) {
    console.log('[Chess Trainer] Flip Check: Aborted (board or button not found).');
    return;
  }

  isFlipping = true;
  console.log('[Chess Trainer] Flip Check: Lock acquired.');

  browser.storage.local.get('isFlipped').then(data => {
    const shouldBeFlipped = data.isFlipped || false;
    const isActuallyFlipped = board.classList.contains('flipped');
    console.log(`[Chess Trainer] Flip Check: Should be flipped? ${shouldBeFlipped}. Is it actually flipped? ${isActuallyFlipped}.`);

    if (shouldBeFlipped !== isActuallyFlipped) {
      console.log('[Chess Trainer] Flip Check: Mismatch detected. Clicking flip button.');
      flipButton.click();
    } else {
      console.log('[Chess Trainer] Flip Check: Board is in the correct state.');
    }
  });

  setTimeout(() => {
    isFlipping = false;
    console.log('[Chess Trainer] Flip Check: Lock released.');
  }, 500);
}

function observeTurnIndicator(turnIndicatorNode) {
  console.log('[Chess Trainer] Observer: Now watching turn indicator.', turnIndicatorNode);
  const observer = new MutationObserver(() => {
    const newText = turnIndicatorNode.innerText.trim();
    console.log(`[Chess Trainer] Observer: Turn indicator text changed to "${newText}".`);

    if (newText.includes('to Move')) {
      console.log('[Chess Trainer] Observer: "to Move" detected. Triggering flip check.');
      flipBoardIfNeeded();
    } else {
      console.log('[Chess Trainer] Observer: Text is not a turn indicator (e.g., "Correct"). Ignoring.');
    }
  });

  observer.observe(turnIndicatorNode, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Initial check in case the script loads after the indicator is already there
  if (turnIndicatorNode.innerText.trim().includes('to Move')) {
    console.log('[Chess Trainer] Observer: Initial check found a turn indicator. Triggering flip check.');
    flipBoardIfNeeded();
  }
}

function run() {
  console.log('[Chess Trainer] Content script loaded.');

  const turnIndicatorSelector = 'span.section-heading-title.section-heading-normal';

  const elementFinderObserver = new MutationObserver((mutations, observer) => {
    const turnIndicatorNode = document.querySelector(turnIndicatorSelector);
    if (turnIndicatorNode) {
      console.log('[Chess Trainer] Observer: Found turn indicator element.');
      observer.disconnect();
      observeTurnIndicator(turnIndicatorNode);
    }
  });

  elementFinderObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.isFlipped) {
      console.log('[Chess Trainer] Observer: Storage change detected from popup.');
      flipBoardIfNeeded();
    }
  });
}

run(); 