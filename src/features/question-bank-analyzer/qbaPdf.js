/**
 * Quick image-PDF export for the Question Bank Analyzer.
 *
 * This is the "safe everywhere" path: html2canvas-pro paints the report DOM
 * exactly as it looks, then jsPDF slices that bitmap into A4 pages. It is
 * heavier than the print path but preserves complex tables and Bangla glyphs
 * with the browser's own font shaping (jsPDF text APIs are never used).
 */

export function reportBaseName(code) {
  const clean = String(code || 'course')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || 'course';
}

export function reportFileName(code) {
  return `${reportBaseName(code)}_question_bank_analysis.pdf`;
}

function waitForFontsAndLayout(element) {
  return new Promise((resolve) => {
    // Wait for fonts, then an extra frame for layout to settle
    const checkFonts = async () => {
      try {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      } catch {
        /* best effort */
      }
      // Give layout one more paint cycle
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 50);
        });
      });
    };
    checkFonts();
  });
}

export async function downloadReportImagePdf(element, code) {
  if (!element) throw new Error('The report is not ready yet.');

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);

  // Wait for fonts and layout to stabilize
  await waitForFontsAndLayout(element);

  // Use getBoundingClientRect for accurate dimensions (works with absolute positioned hidden element)
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(rect.width) || element.scrollWidth;
  const height = Math.ceil(rect.height) || element.scrollHeight;

  const canvas = await html2canvas(element, {
    scale: 2.5, // Higher scale for better text quality
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    // Ensure we capture the full element even if it overflows viewport
    x: 0,
    y: 0,
    scrollX: 0,
    scrollY: 0,
  });

  if (!canvas || !canvas.width || !canvas.height) {
    throw new Error('The report could not be captured. Try the print-based PDF instead.');
  }

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const imageWidth = pageWidth - margin * 2;
  const pxPerMm = canvas.width / imageWidth;
  const sliceHeight = Math.max(1, Math.floor((pageHeight - margin * 2) * pxPerMm));
  const totalSlices = Math.max(1, Math.ceil(canvas.height / sliceHeight));

  for (let index = 0; index < totalSlices; index += 1) {
    if (index > 0) pdf.addPage();
    const sourceY = index * sliceHeight;
    const sourceHeight = Math.min(sliceHeight, canvas.height - sourceY);
    if (sourceHeight <= 0) break;

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sourceHeight;
    const context = slice.getContext('2d');
    if (!context) throw new Error('The browser could not prepare the PDF image.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, slice.width, slice.height);
    context.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);

    const imageHeight = sourceHeight / pxPerMm;
    pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, imageWidth, imageHeight, undefined, 'FAST');
  }

  pdf.save(reportFileName(code));
}

export default downloadReportImagePdf;
