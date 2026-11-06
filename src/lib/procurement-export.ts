import { INDICATIVE_LABEL, type EstimateLine, type PurchaseEstimate } from "./procurement";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export type EstimateExportData = {
  estimate: PurchaseEstimate;
  lines: EstimateLine[];
};

export function generatePrintableHtml(data: EstimateExportData): string {
  const { estimate, lines } = data;
  const rows = lines.map(line => `
    <tr>
      <td style="text-align:center">${escapeHtml(line.lineNumber)}</td>
      <td>${escapeHtml(line.materialName)}</td>
      <td>${escapeHtml(line.description ?? "")}</td>
      <td>${escapeHtml(line.specifications ?? "")}</td>
      <td style="text-align:right">${formatNumber(line.quantity)}</td>
      <td style="text-align:center">${escapeHtml(line.unit)}</td>
      <td style="text-align:right">${formatMoney(line.estimatedUnitPrice, estimate.currency)}</td>
      <td style="text-align:right;font-weight:600">${formatMoney(line.lineTotal, estimate.currency)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(estimate.documentNumber)} — Purchase Estimate</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; padding: 24px; max-width: 900px; margin: 0 auto; }
  @media print { body { padding: 0; } }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
  .company { font-size: 14px; line-height: 1.5; }
  .company-name { font-size: 18px; font-weight: 700; }
  .doc-title { font-size: 20px; font-weight: 700; text-align: right; }
  .doc-number { font-size: 13px; color: #666; text-align: right; }
  .indicative { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 8px 12px; font-size: 12px; font-weight: 600; color: #856404; margin-bottom: 16px; text-align: center; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; margin-bottom: 20px; font-size: 13px; }
  .meta dt { font-weight: 600; color: #555; }
  .meta dd { color: #1a1a1a; margin-bottom: 4px; }
  .supplier { background: #f8f9fa; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
  .supplier-title { font-weight: 700; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
  thead th { background: #f1f5f9; padding: 8px 6px; text-align: left; font-weight: 600; border-bottom: 2px solid #cbd5e1; }
  tbody td { padding: 6px; border-bottom: 1px solid #e2e8f0; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .totals { margin-left: auto; width: 320px; font-size: 13px; }
  .totals dt { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals dd { display: flex; justify-content: space-between; padding: 4px 0; border-top: 1px solid #e2e8f0; }
  .grand-total { display: flex; justify-content: space-between; padding: 8px 0; font-size: 16px; font-weight: 700; border-top: 2px solid #1a1a1a; }
  .notes { margin-top: 24px; font-size: 12px; color: #555; white-space: pre-wrap; }
  @media print { .no-print { display: none; } }
  .no-print { margin-top: 24px; text-align: center; }
  .no-print button { padding: 10px 24px; font-size: 14px; border: none; border-radius: 6px; background: #1a1a1a; color: #fff; cursor: pointer; }
</style>
</head>
<body>
  <div class="header">
    <div class="company">
      ${estimate.companyName ? `<div class="company-name">${escapeHtml(estimate.companyName)}</div>` : ""}
      ${estimate.companyAddress ? `<div>${escapeHtml(estimate.companyAddress)}</div>` : ""}
      ${estimate.companyContact ? `<div>${escapeHtml(estimate.companyContact)}</div>` : ""}
    </div>
    <div>
      <div class="doc-title">Purchase Estimate</div>
      <div class="doc-number">${escapeHtml(estimate.documentNumber)} · Rev ${estimate.revision}</div>
    </div>
  </div>

  <div class="indicative">${escapeHtml(INDICATIVE_LABEL)}</div>

  <dl class="meta">
    <div><dt>Document date</dt><dd>${formatDate(estimate.documentDate)}</dd></div>
    <div><dt>Planned delivery</dt><dd>${formatDate(estimate.plannedDeliveryDate) || "Not specified"}</dd></div>
    <div><dt>Project</dt><dd>${escapeHtml(estimate.projectName ?? "")}</dd></div>
    <div><dt>Currency</dt><dd>${escapeHtml(estimate.currency)}</dd></div>
  </dl>

  ${estimate.supplierName ? `
  <div class="supplier">
    <div class="supplier-title">Supplier (for reference only)</div>
    <div>${escapeHtml(estimate.supplierName)}</div>
    ${estimate.supplierContact ? `<div>${escapeHtml(estimate.supplierContact)}</div>` : ""}
  </div>` : ""}

  <table>
    <thead>
      <tr>
        <th style="width:32px">No</th>
        <th>Material</th>
        <th>Description</th>
        <th>Specs</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:center">Unit</th>
        <th style="text-align:right">Unit price</th>
        <th style="text-align:right">Line total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <dl class="totals">
    <dt><span>Subtotal</span><span>${formatMoney(estimate.subtotal, estimate.currency)}</span></dt>
    ${estimate.transportCost > 0 ? `<dt><span>Transport</span><span>${formatMoney(estimate.transportCost, estimate.currency)}</span></dt>` : ""}
    ${estimate.taxAmount > 0 ? `<dt><span>Tax</span><span>${formatMoney(estimate.taxAmount, estimate.currency)}</span></dt>` : ""}
    ${estimate.discountAmount > 0 ? `<dt><span>Discount</span><span>-${formatMoney(estimate.discountAmount, estimate.currency)}</span></dt>` : ""}
    <dd class="grand-total"><span>Grand total</span><span>${formatMoney(estimate.grandTotal, estimate.currency)}</span></dd>
  </dl>

  ${estimate.notesTerms ? `<div class="notes">${escapeHtml(estimate.notesTerms)}</div>` : ""}

  <div class="no-print">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
</body>
</html>`;
}

export function openPrintWindow(data: EstimateExportData) {
  const html = generatePrintableHtml(data);
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    throw new Error("Could not open the print window. Allow pop-ups for this site and try again.");
  }
  win.document.write(html);
  win.document.close();
}

export function generateExcelHtml(data: EstimateExportData): string {
  const { estimate, lines } = data;
  const rows = lines.map(line => `    <tr>
      <td style="text-align:center">${escapeHtml(line.lineNumber)}</td>
      <td>${escapeHtml(line.materialName)}</td>
      <td>${escapeHtml(line.description ?? "")}</td>
      <td>${escapeHtml(line.specifications ?? "")}</td>
      <td style="text-align:right">${formatNumber(line.quantity)}</td>
      <td>${escapeHtml(line.unit)}</td>
      <td style="text-align:right">${line.estimatedUnitPrice}</td>
      <td style="text-align:right">=PRODUCT(E${line.sortOrder + 9}:G${line.sortOrder + 9})</td>
    </tr>`).join("");

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Purchase Estimate</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
<table border="1">
  <tr><td colspan="8" style="font-size:18pt;font-weight:bold">${escapeHtml(estimate.companyName ?? "Purchase Estimate")}</td></tr>
  <tr><td colspan="8" style="font-size:10pt;color:gray">${escapeHtml(INDICATIVE_LABEL)}</td></tr>
  <tr><td colspan="8"></td></tr>
  <tr><td style="font-weight:bold">Document No.</td><td>${escapeHtml(estimate.documentNumber)}</td><td style="font-weight:bold">Date</td><td>${formatDate(estimate.documentDate)}</td><td style="font-weight:bold">Currency</td><td>${escapeHtml(estimate.currency)}</td><td style="font-weight:bold">Revision</td><td>${estimate.revision}</td></tr>
  <tr><td style="font-weight:bold">Project</td><td colspan="3">${escapeHtml(estimate.projectName ?? "")}</td><td style="font-weight:bold">Planned delivery</td><td colspan="3">${formatDate(estimate.plannedDeliveryDate)}</td></tr>
  ${estimate.supplierName ? `<tr><td style="font-weight:bold">Supplier</td><td colspan="7">${escapeHtml(estimate.supplierName)}</td></tr>` : ""}
  <tr><td colspan="8"></td></tr>
  <tr style="background:#f1f5f9;font-weight:bold">
    <td>No</td><td>Material</td><td>Description</td><td>Specifications</td>
    <td style="text-align:right">Qty</td><td>Unit</td><td style="text-align:right">Unit Price</td><td style="text-align:right">Line Total</td>
  </tr>
${rows}
  <tr><td colspan="7" style="text-align:right;font-weight:bold">Subtotal</td><td style="text-align:right">${estimate.subtotal}</td></tr>
  <tr><td colspan="7" style="text-align:right">Transport</td><td style="text-align:right">${estimate.transportCost}</td></tr>
  <tr><td colspan="7" style="text-align:right">Tax</td><td style="text-align:right">${estimate.taxAmount}</td></tr>
  <tr><td colspan="7" style="text-align:right">Discount</td><td style="text-align:right">-${estimate.discountAmount}</td></tr>
  <tr><td colspan="7" style="text-align:right;font-weight:bold;font-size:12pt">Grand Total</td><td style="text-align:right;font-weight:bold;font-size:12pt">${estimate.grandTotal}</td></tr>
</table>
${estimate.notesTerms ? `<p style="font-size:9pt;color:gray;margin-top:12px">${escapeHtml(estimate.notesTerms)}</p>` : ""}
</body>
</html>`;
}

export function downloadExcel(data: EstimateExportData) {
  const html = generateExcelHtml(data);
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${data.estimate.documentNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
