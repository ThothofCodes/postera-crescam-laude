// Copyright (c) 2026 Thoth of Codes. PDF Receipt Generator — MinIO storage
const { uploadBuffer, fileUrl, MINIO_BUCKET } = require('../config/cloudinary');

function receiptHTML(invoice) {
  const items = (invoice.lineItems || []).map((item) => `<tr><td>${item.description}</td><td class="r">${item.qty || 1}</td>
     <td class="r">KES ${Number(item.unitPrice || 0).toLocaleString()}</td>
     <td class="r">KES ${Number(item.total || item.unitPrice || 0).toLocaleString()}</td></tr>`).join('');
  const paid = Number(invoice.amountPaid || invoice.totalAmount || 0);
  const vat = (paid * 0.16).toFixed(2);
  const sub = (paid - Number(vat)).toFixed(2);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    body{font-family:Arial,sans-serif;color:#1a2a4a;margin:0;padding:40px;font-size:13px}
    .header{background:#0d1f35;color:#fff;padding:24px;border-radius:6px;margin-bottom:24px}
    .header h1{margin:0;font-size:22px;color:#c8973a}.header p{margin:4px 0;font-size:12px;color:#8fa8c0}
    .badge{display:inline-block;background:#1a6b3c;color:#fff;padding:4px 12px;border-radius:3px;font-size:11px;font-weight:bold}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
    .meta-box{background:#f4f7fa;border-left:4px solid #2e6b9e;padding:12px;border-radius:0 4px 4px 0}
    .meta-box label{font-size:10px;color:#8a9bac;text-transform:uppercase;letter-spacing:.08em;display:block}
    .meta-box span{font-weight:bold;font-size:14px;color:#0d1f35}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th{background:#0d1f35;color:#c8973a;padding:8px 12px;text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase}
    td{padding:8px 12px;border-bottom:1px solid #e8f0f8;font-size:12px}
    tr:nth-child(even) td{background:#f8fbfe}
    .r{text-align:right}.totals{text-align:right;font-size:13px}
    .totals td{padding:4px 12px;border:none}
    .total-row td{font-weight:bold;font-size:15px;color:#0d1f35;border-top:2px solid #c8973a;padding-top:8px}
    .footer{margin-top:32px;text-align:center;font-size:11px;color:#8a9bac;border-top:1px solid #e8f0f8;padding-top:16px}
    .ref{background:#e8f5ee;border:1px solid #1a6b3c;padding:8px 16px;border-radius:4px;display:inline-block;margin:8px 0;font-weight:bold;color:#1a6b3c}
  </style></head><body>
  <div class="header">
    <h1>🏢 PCL SOLUTIONS</h1>
    <p>PCL Centre, Nairobi County, Kenya</p>
    <p>Email: info@pclsolutions.co.ke | Tel: +254 700 000 001</p>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <div><h2 style="margin:0;color:#0d1f35">PAYMENT RECEIPT</h2></div>
    <div><span class="badge">✓ PAID</span></div>
  </div>
  <div class="meta">
    <div class="meta-box"><label>Invoice ID</label><span>${invoice.invoiceId || '—'}</span></div>
    <div class="meta-box"><label>M-Pesa Reference</label><span>${invoice.mpesaRef || '—'}</span></div>
    <div class="meta-box"><label>Client</label><span>${invoice.client?.fullName || invoice.clientId || '—'}</span></div>
    <div class="meta-box"><label>Payment Date</label><span>${invoice.paidAt ? new Date(invoice.paidAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }) : '—'}</span></div>
  </div>
  <table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit Price</th><th class="r">Total</th></tr></thead>
  <tbody>${items}</tbody></table>
  <table class="totals"><tbody>
    <tr><td>Subtotal (excl. VAT):</td><td>KES ${Number(sub).toLocaleString()}</td></tr>
    <tr><td>VAT (16%):</td><td>KES ${Number(vat).toLocaleString()}</td></tr>
    <tr class="total-row"><td>TOTAL PAID:</td><td>KES ${paid.toLocaleString()}</td></tr>
  </tbody></table>
  <div style="text-align:center;margin:20px 0">
    <div class="ref">M-Pesa Ref: ${invoice.mpesaRef || 'N/A'}</div>
  </div>
  <div class="footer">
    <p>This is an official receipt from Postera Crescam Laude.</p>
    <p>Receipt ID: REC-${invoice.invoiceId || Date.now()} | Generated: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}</p>
    <p>Thank you for your business! Visit us again at PCL Centre.</p>
  </div>
  </body></html>`;
}

module.exports = async function generateReceipt(invoice) {
  try {
    let puppeteer;
    // eslint-disable-next-line import/no-unresolved
    try { puppeteer = require('puppeteer'); } catch (_) { puppeteer = require('puppeteer-core'); }

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(receiptHTML(invoice), { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm', right: '10mm', bottom: '10mm', left: '10mm',
      },
    });
    await browser.close();

    // Upload PDF to MinIO
    const year = new Date().getFullYear();
    const dept = invoice.departmentSlug || 'general';
    const objectName = `receipts/${dept}/${year}/receipt-${invoice.invoiceId || Date.now()}.pdf`;
    const result = await uploadBuffer(MINIO_BUCKET, objectName, pdfBuffer, 'application/pdf');
    return result.url;
  } catch (err) {
    console.error('[generateReceipt] Error:', err.message);
    return null;
  }
};
