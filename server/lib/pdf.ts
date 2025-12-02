import PDFDocument from 'pdfkit';

export interface ExpenseReportData {
  businessName: string;
  taxId?: string;
  vatNumber?: string;
  reportPeriod: {
    startDate?: string;
    endDate?: string;
  };
  summary: {
    totalReceipts: number;
    totalSpent: number;
    totalTax: number;
    totalVat: number;
  };
  byCategory: Array<{
    name: string;
    count: number;
    total: number;
    tax: number;
    vat: number;
  }>;
  byMerchant: Array<{
    name: string;
    count: number;
    total: number;
    tax: number;
    vat: number;
  }>;
  byMonth: Array<{
    month: string;
    count: number;
    total: number;
    tax: number;
    vat: number;
  }>;
  transactions?: Array<{
    date: string;
    merchant: string;
    category: string;
    total: number;
    tax: number;
    vat: number;
  }>;
}

export function generateExpenseReportPDF(data: ExpenseReportData): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: 40,
      bottom: 40,
      left: 40,
      right: 40
    }
  });

  const pageWidth = doc.page.width - 80;
  const formatCurrency = (amount: number) => `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });
  };
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long' });
  };

  // Header with SlipSafe branding
  doc.fontSize(24)
     .fillColor('#4f46e5')
     .text('SlipSafe', { align: 'center' });
  
  doc.fontSize(14)
     .fillColor('#666')
     .text('Tax & Expense Report', { align: 'center' });
  
  doc.moveDown(1.5);

  // Business Information Box
  doc.rect(40, doc.y, pageWidth, 70)
     .fillAndStroke('#f8fafc', '#e2e8f0');
  
  const boxY = doc.y + 10;
  doc.fillColor('#000')
     .fontSize(14)
     .text(data.businessName, 50, boxY, { continued: false });
  
  doc.fontSize(10)
     .fillColor('#666');
  
  if (data.taxId) {
    doc.text(`Tax ID: ${data.taxId}`, 50, boxY + 20);
  }
  if (data.vatNumber) {
    doc.text(`VAT Number: ${data.vatNumber}`, 50, boxY + 35);
  }
  
  // Report Period (right side of box)
  const periodText = data.reportPeriod.startDate && data.reportPeriod.endDate
    ? `${formatDate(data.reportPeriod.startDate)} - ${formatDate(data.reportPeriod.endDate)}`
    : data.reportPeriod.startDate
    ? `From ${formatDate(data.reportPeriod.startDate)}`
    : data.reportPeriod.endDate
    ? `Until ${formatDate(data.reportPeriod.endDate)}`
    : 'All Time';
  
  doc.fontSize(10)
     .fillColor('#666')
     .text('Report Period:', 350, boxY, { width: 180, align: 'right' });
  doc.fontSize(10)
     .fillColor('#000')
     .text(periodText, 350, boxY + 15, { width: 180, align: 'right' });
  
  doc.y = boxY + 80;

  // Summary Section
  doc.fontSize(14)
     .fillColor('#4f46e5')
     .text('Summary', 40);
  
  doc.moveDown(0.5);
  
  // Summary cards in a row
  const cardWidth = (pageWidth - 30) / 4;
  const cardY = doc.y;
  const cardHeight = 50;
  
  const summaryCards = [
    { label: 'Total Receipts', value: data.summary.totalReceipts.toString(), color: '#4f46e5' },
    { label: 'Total Spent', value: formatCurrency(data.summary.totalSpent), color: '#0ea5e9' },
    { label: 'Total Tax', value: formatCurrency(data.summary.totalTax), color: '#f59e0b' },
    { label: 'Total VAT', value: formatCurrency(data.summary.totalVat), color: '#10b981' },
  ];
  
  summaryCards.forEach((card, i) => {
    const cardX = 40 + (cardWidth + 10) * i;
    doc.rect(cardX, cardY, cardWidth, cardHeight)
       .fillAndStroke('#f8fafc', '#e2e8f0');
    
    doc.fontSize(8)
       .fillColor('#666')
       .text(card.label, cardX + 5, cardY + 8, { width: cardWidth - 10, align: 'center' });
    
    doc.fontSize(12)
       .fillColor(card.color)
       .text(card.value, cardX + 5, cardY + 25, { width: cardWidth - 10, align: 'center' });
  });
  
  doc.y = cardY + cardHeight + 20;

  // Category Breakdown Section
  if (data.byCategory.length > 0) {
    doc.fontSize(14)
       .fillColor('#4f46e5')
       .text('Expenses by Category', 40);
    
    doc.moveDown(0.5);
    
    // Table header
    const tableY = doc.y;
    doc.rect(40, tableY, pageWidth, 20)
       .fill('#4f46e5');
    
    doc.fontSize(9)
       .fillColor('#fff');
    doc.text('Category', 45, tableY + 6, { width: 120 });
    doc.text('Count', 170, tableY + 6, { width: 50, align: 'right' });
    doc.text('Total', 230, tableY + 6, { width: 90, align: 'right' });
    doc.text('Tax', 330, tableY + 6, { width: 90, align: 'right' });
    doc.text('VAT', 430, tableY + 6, { width: 90, align: 'right' });
    
    doc.y = tableY + 20;
    
    // Table rows
    data.byCategory.forEach((cat, i) => {
      const rowY = doc.y;
      const bgColor = i % 2 === 0 ? '#fff' : '#f8fafc';
      doc.rect(40, rowY, pageWidth, 18).fill(bgColor);
      
      doc.fontSize(9)
         .fillColor('#333');
      doc.text(cat.name, 45, rowY + 5, { width: 120 });
      doc.text(cat.count.toString(), 170, rowY + 5, { width: 50, align: 'right' });
      doc.text(formatCurrency(cat.total), 230, rowY + 5, { width: 90, align: 'right' });
      doc.fillColor('#f59e0b').text(formatCurrency(cat.tax), 330, rowY + 5, { width: 90, align: 'right' });
      doc.fillColor('#10b981').text(formatCurrency(cat.vat), 430, rowY + 5, { width: 90, align: 'right' });
      
      doc.y = rowY + 18;
    });
    
    doc.moveDown(1);
  }

  // Vendor Breakdown Section
  if (data.byMerchant.length > 0) {
    // Check if we need a new page
    if (doc.y > 650) {
      doc.addPage();
    }
    
    doc.fontSize(14)
       .fillColor('#4f46e5')
       .text('Expenses by Vendor', 40);
    
    doc.moveDown(0.5);
    
    // Table header
    const tableY = doc.y;
    doc.rect(40, tableY, pageWidth, 20)
       .fill('#4f46e5');
    
    doc.fontSize(9)
       .fillColor('#fff');
    doc.text('Vendor', 45, tableY + 6, { width: 120 });
    doc.text('Count', 170, tableY + 6, { width: 50, align: 'right' });
    doc.text('Total', 230, tableY + 6, { width: 90, align: 'right' });
    doc.text('Tax', 330, tableY + 6, { width: 90, align: 'right' });
    doc.text('VAT', 430, tableY + 6, { width: 90, align: 'right' });
    
    doc.y = tableY + 20;
    
    // Table rows (limit to top 15 vendors to fit on page)
    const topMerchants = data.byMerchant.slice(0, 15);
    topMerchants.forEach((merchant, i) => {
      const rowY = doc.y;
      const bgColor = i % 2 === 0 ? '#fff' : '#f8fafc';
      doc.rect(40, rowY, pageWidth, 18).fill(bgColor);
      
      doc.fontSize(9)
         .fillColor('#333');
      doc.text(merchant.name.substring(0, 25), 45, rowY + 5, { width: 120 });
      doc.text(merchant.count.toString(), 170, rowY + 5, { width: 50, align: 'right' });
      doc.text(formatCurrency(merchant.total), 230, rowY + 5, { width: 90, align: 'right' });
      doc.fillColor('#f59e0b').text(formatCurrency(merchant.tax), 330, rowY + 5, { width: 90, align: 'right' });
      doc.fillColor('#10b981').text(formatCurrency(merchant.vat), 430, rowY + 5, { width: 90, align: 'right' });
      
      doc.y = rowY + 18;
    });
    
    if (data.byMerchant.length > 15) {
      doc.fontSize(8)
         .fillColor('#666')
         .text(`... and ${data.byMerchant.length - 15} more vendors`, 45, doc.y + 5);
      doc.moveDown(0.5);
    }
    
    doc.moveDown(1);
  }

  // Monthly Breakdown Section
  if (data.byMonth.length > 0) {
    // Check if we need a new page
    if (doc.y > 600) {
      doc.addPage();
    }
    
    doc.fontSize(14)
       .fillColor('#4f46e5')
       .text('Monthly Breakdown', 40);
    
    doc.moveDown(0.5);
    
    // Table header
    const tableY = doc.y;
    doc.rect(40, tableY, pageWidth, 20)
       .fill('#4f46e5');
    
    doc.fontSize(9)
       .fillColor('#fff');
    doc.text('Month', 45, tableY + 6, { width: 120 });
    doc.text('Receipts', 170, tableY + 6, { width: 50, align: 'right' });
    doc.text('Total', 230, tableY + 6, { width: 90, align: 'right' });
    doc.text('Tax', 330, tableY + 6, { width: 90, align: 'right' });
    doc.text('VAT', 430, tableY + 6, { width: 90, align: 'right' });
    
    doc.y = tableY + 20;
    
    // Table rows
    data.byMonth.forEach((month, i) => {
      const rowY = doc.y;
      const bgColor = i % 2 === 0 ? '#fff' : '#f8fafc';
      doc.rect(40, rowY, pageWidth, 18).fill(bgColor);
      
      doc.fontSize(9)
         .fillColor('#333');
      doc.text(formatMonth(month.month), 45, rowY + 5, { width: 120 });
      doc.text(month.count.toString(), 170, rowY + 5, { width: 50, align: 'right' });
      doc.text(formatCurrency(month.total), 230, rowY + 5, { width: 90, align: 'right' });
      doc.fillColor('#f59e0b').text(formatCurrency(month.tax), 330, rowY + 5, { width: 90, align: 'right' });
      doc.fillColor('#10b981').text(formatCurrency(month.vat), 430, rowY + 5, { width: 90, align: 'right' });
      
      doc.y = rowY + 18;
    });
    
    doc.moveDown(1);
  }

  // Transaction Details Section (if included)
  if (data.transactions && data.transactions.length > 0) {
    doc.addPage();
    
    doc.fontSize(14)
       .fillColor('#4f46e5')
       .text('Transaction Details', 40);
    
    doc.moveDown(0.5);
    
    // Table header
    let tableY = doc.y;
    doc.rect(40, tableY, pageWidth, 20)
       .fill('#4f46e5');
    
    doc.fontSize(8)
       .fillColor('#fff');
    doc.text('Date', 45, tableY + 6, { width: 70 });
    doc.text('Merchant', 120, tableY + 6, { width: 100 });
    doc.text('Category', 225, tableY + 6, { width: 80 });
    doc.text('Total', 310, tableY + 6, { width: 70, align: 'right' });
    doc.text('Tax', 390, tableY + 6, { width: 60, align: 'right' });
    doc.text('VAT', 460, tableY + 6, { width: 60, align: 'right' });
    
    doc.y = tableY + 20;
    
    // Table rows
    data.transactions.forEach((txn, i) => {
      // Check if we need a new page
      if (doc.y > 750) {
        doc.addPage();
        tableY = 40;
        doc.rect(40, tableY, pageWidth, 20)
           .fill('#4f46e5');
        
        doc.fontSize(8)
           .fillColor('#fff');
        doc.text('Date', 45, tableY + 6, { width: 70 });
        doc.text('Merchant', 120, tableY + 6, { width: 100 });
        doc.text('Category', 225, tableY + 6, { width: 80 });
        doc.text('Total', 310, tableY + 6, { width: 70, align: 'right' });
        doc.text('Tax', 390, tableY + 6, { width: 60, align: 'right' });
        doc.text('VAT', 460, tableY + 6, { width: 60, align: 'right' });
        
        doc.y = tableY + 20;
      }
      
      const rowY = doc.y;
      const bgColor = i % 2 === 0 ? '#fff' : '#f8fafc';
      doc.rect(40, rowY, pageWidth, 16).fill(bgColor);
      
      doc.fontSize(8)
         .fillColor('#333');
      doc.text(formatDate(txn.date), 45, rowY + 4, { width: 70 });
      doc.text(txn.merchant.substring(0, 20), 120, rowY + 4, { width: 100 });
      doc.text(txn.category, 225, rowY + 4, { width: 80 });
      doc.text(formatCurrency(txn.total), 310, rowY + 4, { width: 70, align: 'right' });
      doc.fillColor('#f59e0b').text(formatCurrency(txn.tax), 390, rowY + 4, { width: 60, align: 'right' });
      doc.fillColor('#10b981').text(formatCurrency(txn.vat), 460, rowY + 4, { width: 60, align: 'right' });
      
      doc.y = rowY + 16;
    });
  }

  // Footer
  doc.fontSize(8)
     .fillColor('#999');
  
  const footerY = doc.page.height - 50;
  doc.text('Generated by SlipSafe - Business Expense Management', 40, footerY, { align: 'center', width: pageWidth });
  doc.text(`Report generated on: ${new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 40, footerY + 12, { align: 'center', width: pageWidth });

  return doc;
}

export interface ReceiptPDFData {
  merchant: string;
  date: string;
  total: number;
  returnBy: string | null;
  warrantyEnds: string | null;
  imageUrl?: string;
  qrCodeDataUrl?: string;
  logoPath?: string;
}

export function generateReceiptPDF(data: ReceiptPDFData): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: 50,
      bottom: 50,
      left: 50,
      right: 50
    }
  });

  const { merchant, date, total, returnBy, warrantyEnds, imageUrl, qrCodeDataUrl, logoPath } = data;
  
  // Header with SlipSafe branding and logo
  const pageWidth = doc.page.width - 100;
  const centerX = doc.page.width / 2;
  
  // Add logo if available
  if (logoPath) {
    try {
      doc.image(logoPath, centerX - 30, doc.y, { width: 60, height: 60 });
      doc.y += 70;
    } catch (err) {
      console.error('Failed to load logo for PDF:', err);
    }
  }
  
  doc.fontSize(24)
     .fillColor('#4f46e5')
     .text('SlipSafe', { align: 'center' });
  
  doc.fontSize(12)
     .fillColor('#666')
     .text('Digital Receipt Verification', { align: 'center' });
  
  doc.moveDown(2);
  
  // Receipt Details Section
  doc.fontSize(16)
     .fillColor('#000')
     .text('Receipt Details', { underline: true });
  
  doc.moveDown(0.5);
  
  doc.fontSize(12)
     .fillColor('#333');
  
  // Merchant
  doc.text(`Merchant: `, { continued: true })
     .fillColor('#000')
     .text(merchant);
  
  doc.fillColor('#333');
  
  // Purchase Date
  doc.text(`Purchase Date: `, { continued: true })
     .fillColor('#000')
     .text(new Date(date).toLocaleDateString());
  
  doc.fillColor('#333');
  
  // Total Amount
  doc.text(`Total Amount: `, { continued: true })
     .fillColor('#000')
     .text(`$${total.toFixed(2)}`);
  
  doc.moveDown(2);
  
  // Important Deadlines Section
  doc.fontSize(16)
     .fillColor('#000')
     .text('Important Deadlines', { underline: true });
  
  doc.moveDown(0.5);
  
  doc.fontSize(12)
     .fillColor('#333');
  
  // Return Deadline
  doc.text(`Return By: `, { continued: true })
     .fillColor('#dc2626')
     .text(returnBy ? new Date(returnBy).toLocaleDateString() : 'Not set');
  
  doc.fillColor('#333');
  
  // Warranty Deadline
  doc.text(`Warranty Expires: `, { continued: true })
     .fillColor('#dc2626')
     .text(warrantyEnds ? new Date(warrantyEnds).toLocaleDateString() : 'Not set');
  
  doc.moveDown(2);
  
  // Receipt Image (if available)
  if (imageUrl) {
    try {
      doc.fontSize(16)
         .fillColor('#000')
         .text('Receipt Image', { underline: true });
      
      doc.moveDown(0.5);
      
      // Convert base64 data URL to Buffer if needed
      let imageSource: string | Buffer = imageUrl;
      if (imageUrl.startsWith('data:')) {
        const base64Data = imageUrl.split(',')[1];
        imageSource = Buffer.from(base64Data, 'base64');
      }
      
      // Embed receipt image (centered, max width 400px)
      doc.image(imageSource, {
        fit: [400, 500],
        align: 'center'
      });
      
      doc.moveDown(1);
    } catch (err) {
      console.error('Error embedding receipt image:', err);
      doc.fontSize(10)
         .fillColor('#666')
         .text('(Receipt image unavailable)', { align: 'center' });
      doc.moveDown(1);
    }
  }
  
  // QR Code for verification (if available)
  if (qrCodeDataUrl) {
    try {
      doc.fontSize(16)
         .fillColor('#000')
         .text('Verification Code', { underline: true });
      
      doc.moveDown(0.5);
      
      // Convert base64 data URL to Buffer if needed
      let qrSource: string | Buffer = qrCodeDataUrl;
      if (qrCodeDataUrl.startsWith('data:')) {
        const base64Data = qrCodeDataUrl.split(',')[1];
        qrSource = Buffer.from(base64Data, 'base64');
      }
      
      // Embed QR code image
      doc.image(qrSource, {
        fit: [150, 150],
        align: 'center'
      });
      
      doc.moveDown(0.5);
      
      doc.fontSize(10)
         .fillColor('#666')
         .text('Scan this code to verify your receipt', { align: 'center' });
    } catch (err) {
      console.error('Error embedding QR code:', err);
      doc.fontSize(10)
         .fillColor('#666')
         .text('(QR code verification available online)', { align: 'center' });
    }
  }
  
  // Footer
  doc.moveDown(2);
  doc.fontSize(8)
     .fillColor('#999')
     .text('Generated by SlipSafe - Digital Receipt Management System', { align: 'center' });
  
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
  
  // Note: Caller must call doc.end() after piping to response
  // Example: doc.pipe(res); doc.end();
  
  return doc;
}
