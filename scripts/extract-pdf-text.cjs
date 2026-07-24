// Render PDF first page to a PNG image using pdfjs-dist
const fs = require('fs');
const path = require('path');
const { getDocument } = require('pdfjs-dist');

async function main() {
  const pdfPath = path.join(__dirname, '..', 'public', 'reference-cover.pdf');
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  
  const doc = await getDocument({ data }).promise;
  console.log('Pages:', doc.numPages);
  
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  
  console.log('Viewport:', viewport.width, 'x', viewport.height);
  
  // Extract text content first
  const textContent = await page.getTextContent();
  console.log('\n=== TEXT ITEMS (with position) ===');
  for (const item of textContent.items) {
    if (item.str.trim()) {
      console.log(
        `"${item.str}" ` +
        `font: "${item.fontName}" ` +
        `size: ${item.height || item.fontSize || '?'} ` +
        `pos: (${item.transform[4].toFixed(0)}, ${item.transform[5].toFixed(0)}) ` +
        `width: ${item.width.toFixed(0)}`
      );
    }
  }
  
  console.log('\n=== ALL TEXT (plain) ===');
  console.log(textContent.items.map(i => i.str).join(' '));
  
  await doc.destroy();
}

main().catch(e => console.error('Error:', e.message, '\n', e.stack));
