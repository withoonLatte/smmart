/**
 * Isolated Print Engine for Supermarket Thermal Receipt & Documents
 * Creates a dedicated isolated hidden iframe, injects clean CSS & content,
 * triggers print on the iframe context, and avoids any modal/backdrop clipping issues.
 */
export function printReceiptIsolated(elementHtml: string, title: string = "ใบเสร็จรับเงิน") {
  // Remove existing print iframe if any
  const existingFrame = document.getElementById("isolated-print-iframe");
  if (existingFrame) {
    existingFrame.remove();
  }

  const iframe = document.createElement("iframe");
  iframe.id = "isolated-print-iframe";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error("Failed to access iframe document for printing");
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 8px 12px;
          font-family: 'Sarabun', 'Courier New', monospace, sans-serif;
          font-size: 12px;
          line-height: 1.35;
          color: #000;
          background: #fff;
          width: 76mm;
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .receipt-center { text-align: center; }
        .receipt-right { text-align: right; }
        .receipt-bold { font-weight: bold; }
        .receipt-divider {
          border-top: 1px dashed #666;
          margin: 6px 0;
        }
        .receipt-double-divider {
          border-top: 2px dashed #000;
          margin: 6px 0;
        }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; vertical-align: top; }
        img { max-width: 100%; height: auto; }
        .qr-center { display: flex; justify-content: center; margin: 6px 0; }
      </style>
    </head>
    <body>
      ${elementHtml}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 250);
        };
      </script>
    </body>
    </html>
  `);
  doc.close();
}
