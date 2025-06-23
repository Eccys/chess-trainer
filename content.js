function flipBoard() {
  const flipButton = document.getElementById('board-controls-flip');
  if (flipButton) {
    flipButton.click();
  }
}

function observeBoard() {
  browser.storage.local.get('isFlipped').then(data => {
    if (data.isFlipped) {
      flipBoard(); // Try to flip right away

      const observer = new MutationObserver((mutationsList, observer) => {
        for(const mutation of mutationsList) {
          if (mutation.type === 'childList') {
            const flipButton = document.getElementById('board-controls-flip');
            if (flipButton) {
              flipBoard();
              observer.disconnect(); // Stop observing once flipped
              break;
            }
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }
  });
}

// Listen for changes in storage
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.isFlipped) {
    // If setting turns on, and we are on the page, try to flip.
    if(changes.isFlipped.newValue === true) {
        observeBoard();
    }
  }
});

// Initial run
observeBoard(); 