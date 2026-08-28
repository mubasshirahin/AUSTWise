const fs = require('fs');
const lines = fs.readFileSync('src/features/analytics/AnalyticsPage.jsx', 'utf8').split('\n');
lines.forEach((l, i) => console.log(`${String(i + 1).padStart(3)}|${l}`));
