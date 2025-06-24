chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ isFlipped: false });
}); 