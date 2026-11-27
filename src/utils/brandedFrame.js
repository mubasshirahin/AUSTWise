// Shared AUSTWise export sheet, used by every image / PDF export that
// captures a page (mindmap, student directory, notebook) so they all match
// the routine export's look. `brand` = the helpers routineExport.js exports.

/**
 * Wrap a capture in the AUSTWise export sheet (same look as the routine
 * export): logo + wordmark + title header with date and stats, the capture
 * in a bordered card, and a "Made with AUSTWise" footer. Flat theme surfaces only
 * (house style: no gradients / glows). `brand` = routineExport's helpers.
 */
export function drawBrandedFrame(shot, brand, logo, { title = '', stats = '', footerLabel = '' } = {}) {
  const { readPalette, setFont, drawBrand, roundRect } = brand;
  const P = readPalette();
  const S = 2; // the capture is rendered at 2x
  const M = 40 * S;
  const headerH = 64 * S;
  const gap = 20 * S;
  const footerH = 28 * S;
  const W = Math.max(shot.width + M * 2, 760 * S);
  const H = M + headerH + gap + shot.height + gap + footerH + M * 0.75;

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);

  // Header: brand left, date + stats right
  drawBrand(ctx, P, logo, M, M, 44 * S, 'left', title);
  const now = new Date();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  setFont(ctx, P, 15 * S, 700);
  ctx.fillStyle = P.text;
  ctx.fillText(now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), W - M, M + 14 * S);
  setFont(ctx, P, 11.5 * S, 500);
  ctx.fillStyle = P.text3;
  ctx.fillText(stats, W - M, M + 36 * S);

  // Divider under the header
  const divY = M + headerH;
  ctx.fillStyle = P.border;
  ctx.fillRect(M, divY, W - M * 2, 1 * S);

  // The map in a rounded, bordered card
  const cardX = M;
  const cardY = divY + gap;
  const r = 16 * S;
  ctx.save();
  roundRect(ctx, cardX, cardY, shot.width, shot.height, r);
  ctx.clip();
  ctx.drawImage(shot, cardX, cardY);
  ctx.restore();
  roundRect(ctx, cardX + 0.5 * S, cardY + 0.5 * S, shot.width - S, shot.height - S, r);
  ctx.lineWidth = 1 * S;
  ctx.strokeStyle = P.border;
  ctx.stroke();

  // Footer: "Made with AUSTWise" left, export time right
  const fy = cardY + shot.height + gap + footerH / 2;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  setFont(ctx, P, 12 * S, 500);
  ctx.fillStyle = P.text3;
  const made = 'Made with ';
  ctx.fillText(made, M, fy);
  const madeW = ctx.measureText(made).width;
  setFont(ctx, P, 12 * S, 800);
  ctx.fillStyle = P.accent;
  ctx.fillText('AUSTWise', M + madeW, fy);
  const brandW = ctx.measureText('AUSTWise').width;
  setFont(ctx, P, 12 * S, 500);
  ctx.fillStyle = P.text3;
  if (footerLabel) ctx.fillText(`  ·  ${footerLabel}`, M + madeW + brandW, fy);
  ctx.textAlign = 'right';
  ctx.fillText(`Exported ${now.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`, W - M, fy);
  return out;
}

/** Load the brand helpers + logo and frame `shot`. */
export async function frameCapture(shot, opts) {
  const brand = await import('../features/dashboard/routineExport');
  const { default: brandMark } = await import('../assets/austwise-icon-final.svg');
  const logo = await brand.loadLogo(brandMark);
  return { framed: drawBrandedFrame(shot, brand, logo, opts), brand };
}

/** Save a framed canvas as png / jpg. */
export async function saveFramedImage(framed, brand, base, format) {
  const jpg = format === 'jpg';
  const blob = await brand.toBlob(framed, jpg ? 'image/jpeg' : 'image/png', 0.95);
  brand.saveBlob(blob, `${base}.${jpg ? 'jpg' : 'png'}`);
}

/** Save a framed canvas as an A4 PDF, page-filled with the sheet colour. */
export async function saveFramedPDF(framed, brand, base) {
  const { default: jsPDF } = await import('jspdf');
  const P = brand.readPalette();
  const landscape = framed.width > framed.height;
  const pdf = new jsPDF(landscape ? 'l' : 'p', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgH = (framed.height * pageW) / framed.width;
  const img = framed.toDataURL('image/jpeg', 0.95);
  const pages = Math.max(1, Math.ceil(imgH / pageH - 0.001));
  for (let i = 0; i < pages; i++) {
    if (i > 0) pdf.addPage();
    const [r, g, b] = (P.bg.match(/\d+/g) || [255, 255, 255]).map(Number);
    pdf.setFillColor(r, g, b);
    pdf.rect(0, 0, pageW, pageH, 'F');
    pdf.addImage(img, 'JPEG', 0, -i * pageH, pageW, imgH);
  }
  pdf.save(`${base}.pdf`);
}
