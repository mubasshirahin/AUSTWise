// Runs before the app bundle (render-blocking, in <head>). Kept out of
// index.html so the Content-Security-Policy can forbid inline scripts.

// Font CSS is preloaded (non-blocking); turn it into a stylesheet. Was an
// inline onload="" handler, which the CSP would block.
document.querySelectorAll('link[data-async-css]').forEach(function(l) {
  l.rel = 'stylesheet';
});

// One canonical host (Vercel), so the Render mirror never competes in search.
(function() {
  var c = document.querySelector('link[rel="canonical"]');
  if (c) c.href = 'https://austwise.vercel.app' + location.pathname;
})();

// Apply the saved theme/layout before first paint (no flash).
(function() {
  try {
    var t = localStorage.getItem('aust-theme');
    var ok = ['light','dark','midnight','industrial','swiss','newsprint','sketchbook','minimalist-monochrome','terminal','art-deco','bitcoindefi','poster','nexus','cyberpunk','meshtopo','blueprint','obsidian','pastel','prism','toon','lofi','sakura','arcade'];
    if (t && ok.indexOf(t) !== -1) document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.setAttribute('data-theme', 'dark');
    var l = localStorage.getItem('aust-layout');
    if (['classic','studio','bento','compact','aurora','zen','luxe','soft','motion','comic','desk','manga','hud'].indexOf(l) === -1) l = document.documentElement.getAttribute('data-theme') === 'blueprint' ? 'studio' : 'classic';
    document.documentElement.setAttribute('data-layout', l);
  } catch(e) {}
})();
