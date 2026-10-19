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

function waitForFontsAndLayout() {
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

/**
 * Split the report into page-sized pieces WITHOUT cutting a table row in
 * half. A row that is cut across two pages reads like a broken table, so the
 * break is moved to the end of the row that would have been split.
 *
 * @returns {Array<{ top: number, height: number }>} page boxes in CSS pixels
 */
function planPages(element, pageHeightPx) {
  // Measure the element and its rows in the same pass — the capture can move
  // the page, and a stale offset would put the breaks in the wrong place.
  const rect = element.getBoundingClientRect();
  const blocks = Array.from(
    element.querySelectorAll('tr, .qba-report-heading, .qba-report-topic-head, .qba-report-plan li'),
  )
    .map((node) => {
      const box = node.getBoundingClientRect();
      return { top: box.top - rect.top, bottom: box.bottom - rect.top };
    })
    .filter((block) => block.bottom - block.top > 1)
    .sort((a, b) => a.top - b.top);

  const pages = [];
  let y = 0;
  let guard = 0;

  while (y < rect.height - 1 && guard < 500) {
    guard += 1;
    let end = Math.min(y + pageHeightPx, rect.height);

    const straddling = blocks.find((block) => (
      block.top < end - 0.5 && block.bottom > end + 0.5
    ));
    if (straddling) {
      if (straddling.bottom - y <= pageHeightPx) {
        // The row fits on this page — keep it whole and break after it.
        end = straddling.bottom;
      } else {
        // The row does not fit in what is left of this page — break before it
        // so it starts the next page instead of being cut in half.
        end = Math.max(straddling.top, y + 1);
      }
    }
    if (end - y < 1) end = Math.min(y + pageHeightPx, rect.height);
    if (end > y + pageHeightPx) end = y + pageHeightPx;

    pages.push({ top: y, height: end - y });
    y = end;
  }

  if (!pages.length) pages.push({ top: 0, height: rect.height });
  return pages;
}

export async function downloadReportImagePdf(element, code) {
  if (!element) throw new Error('The report is not ready yet.');

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);

  // Wait for fonts and layout to stabilize
  await waitForFontsAndLayout();

  // The sheet is laid out at a fixed A4 content width, so the crop starts at
  // the element's own top-left corner (html2canvas adds the element offset).
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
  // The same 15mm margin the print stylesheet uses (@page), so the image PDF
  // and the print PDF have identical margins and text size.
  const margin = 15;
  const imageWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  // How much of the report (in CSS pixels) fits on one page.
  const pxPerMm = width / imageWidth;
  const pageHeightPx = contentHeight * pxPerMm;
  const scale = canvas.width / width; // canvas pixels per CSS pixel

  const pages = planPages(element, pageHeightPx);

  pages.forEach((page, index) => {
    if (index > 0) pdf.addPage();

    const sourceY = Math.max(0, Math.round(page.top * scale));
    const sourceHeight = Math.min(
      Math.round(page.height * scale),
      canvas.height - sourceY,
    );
    if (sourceHeight <= 0) return;

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sourceHeight;
    const context = slice.getContext('2d');
    if (!context) throw new Error('The browser could not prepare the PDF image.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, slice.width, slice.height);
    context.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);

    const imageHeight = sourceHeight / (canvas.width / imageWidth);
    pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, imageWidth, imageHeight, undefined, 'FAST');
  });

  pdf.save(reportFileName(code));
}

export default downloadReportImagePdf;
