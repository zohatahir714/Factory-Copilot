/**
 * Document Archive & Windows Print Service Manager
 * Handles local storage persistence of generated invoices, POs, and reports,
 * and executes native Windows print service triggers.
 */

export interface SavedDocumentRecord {
  id: string;
  docNumber: string;
  type: 'invoice' | 'purchase_order' | 'cash_voucher' | 'inventory_report';
  title: string;
  partyName?: string;
  amount?: number;
  savedAt: string;
  dataSnapshot: any;
}

const STORAGE_KEY = 'copilot_saved_documents';

export function getSavedDocuments(): SavedDocumentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse saved documents from localStorage:', err);
    return [];
  }
}

export function saveDocumentToLocalStorage(
  type: 'invoice' | 'purchase_order' | 'cash_voucher' | 'inventory_report',
  data: any,
  branding?: any
): SavedDocumentRecord {
  const existing = getSavedDocuments();

  let docNumber = 'DOC-UNKNOWN';
  let title = 'Business Document';
  let partyName = '';
  let amount = 0;

  if (type === 'invoice') {
    docNumber = data.invoiceNumber || `INV-${Date.now().toString().slice(-4)}`;
    title = `Sales Tax Invoice #${docNumber}`;
    partyName = data.customerName || 'Registered Buyer';
    amount = Number(data.totalAmount) || 0;
  } else if (type === 'purchase_order') {
    docNumber = data.poNumber || `PO-${Date.now().toString().slice(-4)}`;
    title = `Purchase Order #${docNumber}`;
    partyName = data.supplierName || 'Primary Supplier';
    amount = Number(data.totalAmount) || 0;
  } else if (type === 'cash_voucher') {
    docNumber = `CSH-${data.id || Date.now().toString().slice(-4)}`;
    title = `${data.type === 'inflow' ? 'Cash Receipt' : 'Cash Payment'} Voucher`;
    partyName = data.category?.replace('_', ' ') || 'General Account';
    amount = Number(data.amount) || 0;
  } else if (type === 'inventory_report') {
    docNumber = `RPT-${new Date().toISOString().slice(0, 10)}`;
    title = `Inventory Valuation Report (${new Date().toLocaleDateString('en-PK')})`;
    partyName = `${Array.isArray(data) ? data.length : 0} Materials Tracked`;
    amount = Array.isArray(data)
      ? data.reduce((sum: number, p: any) => sum + (p.currentStock * p.costPrice), 0)
      : 0;
  }

  const record: SavedDocumentRecord = {
    id: `${type}_${docNumber}_${Date.now()}`,
    docNumber,
    type,
    title,
    partyName,
    amount,
    savedAt: new Date().toISOString(),
    dataSnapshot: { ...data, brandingSnapshot: branding }
  };

  // Keep up to 50 most recent documents, replace if exact match already exists
  const filtered = existing.filter(d => d.docNumber !== docNumber || d.type !== type);
  const updated = [record, ...filtered].slice(0, 50);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to write document to localStorage:', err);
  }

  return record;
}

export function deleteSavedDocument(id: string): SavedDocumentRecord[] {
  const existing = getSavedDocuments();
  const updated = existing.filter(d => d.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to delete document from localStorage:', err);
  }
  return updated;
}

/**
 * Triggers native Windows / OS Print Service directly and reliably.
 * Uses an isolated hidden iframe with embedded CSS to ensure cross-iframe
 * compatibility in sandboxed web environments.
 */
export function triggerWindowsPrintService(
  elementId: string = 'printable-document',
  documentTitle: string = 'Document',
  paperFormat: '80mm' | 'a4' = 'a4'
): boolean {
  const printableElement = document.getElementById(elementId);
  if (!printableElement) {
    console.warn(`Element #${elementId} not found, invoking default window.print()`);
    window.print();
    return true;
  }

  try {
    // Check or create isolated hidden iframe
    let printFrame = document.getElementById('auraops-print-iframe') as HTMLIFrameElement;
    if (printFrame && printFrame.parentNode) {
      printFrame.parentNode.removeChild(printFrame);
    }

    printFrame = document.createElement('iframe');
    printFrame.id = 'auraops-print-iframe';
    printFrame.style.position = 'fixed';
    printFrame.style.top = '-9999px';
    printFrame.style.left = '-9999px';
    printFrame.style.width = paperFormat === '80mm' ? '380px' : '1000px';
    printFrame.style.height = '1400px';
    printFrame.style.border = 'none';
    printFrame.style.opacity = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (!frameDoc) {
      window.print();
      return true;
    }

    // Capture styling from current page
    const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(node => node.outerHTML)
      .join('\n');

    const pageCss =
      paperFormat === '80mm'
        ? `@page {
             size: 80mm auto;
             margin: 0mm;
           }
           body {
             background-color: #ffffff !important;
             color: #000000 !important;
             margin: 0 !important;
             padding: 0 !important;
             font-family: 'JetBrains Mono', monospace, -apple-system, sans-serif !important;
             -webkit-print-color-adjust: exact !important;
             print-color-adjust: exact !important;
           }
           #${elementId} {
             border: none !important;
             box-shadow: none !important;
             width: 80mm !important;
             max-width: 80mm !important;
             margin: 0 auto !important;
             padding: 3mm 4mm !important;
           }`
        : `@page {
             size: A4;
             margin: 12mm 15mm;
           }
           body {
             background-color: #ffffff !important;
             color: #0f172a !important;
             margin: 0 !important;
             padding: 0 !important;
             font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
             -webkit-print-color-adjust: exact !important;
             print-color-adjust: exact !important;
           }
           #${elementId} {
             border: none !important;
             box-shadow: none !important;
             width: 100% !important;
             max-width: 100% !important;
             margin: 0 !important;
             padding: 0 !important;
           }`;

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>${documentTitle}</title>
          ${styleTags}
          <style>
            ${pageCss}
            .no-print {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <div style="padding: 0;">
            ${printableElement.outerHTML}
          </div>
        </body>
      </html>
    `);
    frameDoc.close();

    // Give browser time to load styles and font glyphs
    setTimeout(() => {
      try {
        if (printFrame.contentWindow) {
          printFrame.contentWindow.focus();
          printFrame.contentWindow.print();
        } else {
          window.print();
        }
      } catch (printErr) {
        console.warn('Iframe print error, invoking main window print:', printErr);
        window.print();
      }
    }, 450);

    return true;
  } catch (err) {
    console.error('Failed to trigger hidden iframe print:', err);
    window.print();
    return true;
  }
}

/**
 * Downloads the printable document as a standalone offline HTML/PDF-ready file
 */
export function downloadDocumentHTML(elementId: string = 'printable-document', filename: string = 'document.html') {
  const printableElement = document.getElementById(elementId);
  if (!printableElement) return;

  const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(node => node.outerHTML)
    .join('\n');

  const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${filename.replace('.html', '')}</title>
  ${styleTags}
  <style>
    body {
      background: #f8fafc;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      padding: 24px;
      display: flex;
      justify-content: center;
    }
    #${elementId} {
      background: white;
      max-width: 900px;
      width: 100%;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border-radius: 12px;
      padding: 32px;
    }
    @media print {
      body { background: white; padding: 0; }
      #${elementId} { box-shadow: none; border: none; padding: 0; }
    }
  </style>
</head>
<body>
  ${printableElement.outerHTML}
</body>
</html>`;

  const blob = new Blob([fullHTML], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
