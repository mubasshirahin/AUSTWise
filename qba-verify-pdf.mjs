import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const file = process.argv[2];
const buf = new Uint8Array(fs.readFileSync(file));
const doc = await getDocument({ data: buf, disableWorker: true, useSystemFonts: true }).promise;
const pages = [];
for (let i = 1; i <= doc.numPages; i += 1) {
  const page = await doc.getPage(i);
  const viewport = page.getViewport({ scale: 1 });
  const ops = await page.getOperatorList();
  pages.push({ page: i, width: Math.round(viewport.width), height: Math.round(viewport.height), ops: ops.fnArray.length });
}
console.log(JSON.stringify({ file, bytes: buf.length, numPages: doc.numPages, pages }, null, 2));
await doc.destroy();
