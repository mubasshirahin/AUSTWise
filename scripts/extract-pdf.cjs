const fs = require('fs');
const path = require('path');

const pdfPath = path.join(__dirname, '..', 'public', 'reference-cover.pdf');
const data = fs.readFileSync(pdfPath);
const content = data.toString('binary');

// Find text between parentheses in PDF (standard PDF text encoding)
const regex = /\(([^)]*)\)/g;
let match;
const texts = [];

while ((match = regex.exec(content)) !== null) {
  const text = match[1];
  // Filter out garbage - keep readable text
  if (text && 
      text.length > 2 && 
      text.length < 200 && 
      /[A-Za-z]{3,}/.test(text) && 
      !text.includes('\\') &&
      !/^\d+$/.test(text.trim()) &&
      !text.includes('cm') &&
      !text.includes('rg') &&
      !text.includes('w ') &&
      !text.startsWith('F1') &&
      !text.includes('BT')
  ) {
    texts.push(text);
  }
}

// Deduplicate and print
const unique = [...new Set(texts)];
unique.forEach(t => console.log(t));
