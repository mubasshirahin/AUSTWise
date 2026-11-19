// Theme from ?theme= before first paint (kept out of app.html for the CSP).
document.documentElement.dataset.theme = new URLSearchParams(location.search).get('theme') || 'dark';
