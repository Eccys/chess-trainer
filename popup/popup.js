const toggle = document.getElementById('flip-toggle');

browser.storage.local.get('isFlipped').then(data => {
  toggle.checked = data.isFlipped || false;
});
 
toggle.addEventListener('change', () => {
  browser.storage.local.set({ isFlipped: toggle.checked });
}); 