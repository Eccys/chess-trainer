const toggle = document.getElementById('flip-toggle');

chrome.storage.local.get('isFlipped').then(data => {
  toggle.checked = data.isFlipped || false;
});
 
toggle.addEventListener('change', () => {
  chrome.storage.local.set({ isFlipped: toggle.checked });
}); 