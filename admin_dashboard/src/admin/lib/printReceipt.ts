import workerURL from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Render the server's authoritative PDF into an isolated print document, so
// browser PDF-viewer extensions and their cross-origin frames aren't required.
export async function printReceiptPDF(popup: Window, bytes: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerURL;
  const task = pdfjs.getDocument({ data: bytes });
  const pdf = await task.promise;
  try {
    const doc = popup.document;
    doc.title = "Shekinah receipt";
    doc.body.replaceChildren();
    const style = doc.createElement("style");
    style.textContent = "@page{size:A4;margin:0}body{margin:0;background:white}canvas{display:block;width:100%;height:auto;break-after:page}canvas:last-child{break-after:auto}";
    doc.head.append(style);
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i), viewport = page.getViewport({ scale: 2 });
      const canvas = doc.createElement("canvas");
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      doc.body.append(canvas);
      await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport, intent: "print" }).promise;
    }
    if (!popup.closed) { popup.focus(); popup.print(); }
  } finally { await task.destroy(); }
}
