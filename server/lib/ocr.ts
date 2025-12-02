/**
 * OCR and receipt parsing helpers
 * Uses Tesseract.js to extract text from receipt images
 * Also handles email receipt text parsing
 * Includes Sharp-based image preprocessing for improved OCR accuracy
 */

import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

/**
 * Preprocess image for better OCR accuracy
 * Applies: grayscale, contrast enhancement, noise reduction, and auto-rotation
 * @param imagePath - Path to the original image
 * @returns Path to the preprocessed image
 */
async function preprocessImage(imagePath: string): Promise<string> {
  const ext = path.extname(imagePath);
  const baseName = path.basename(imagePath, ext);
  const dir = path.dirname(imagePath);
  const processedPath = path.join(dir, `${baseName}_processed${ext}`);
  
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    let pipeline = image
      .rotate()
      .grayscale()
      .normalize()
      .linear(1.3, -20)
      .median(1)
      .sharpen({ sigma: 1.0 });
    
    if (metadata.width && metadata.width < 1500) {
      const scale = Math.min(2, 1500 / metadata.width);
      pipeline = pipeline.resize({
        width: Math.round(metadata.width * scale),
        kernel: 'lanczos3',
        withoutEnlargement: false
      });
    }
    
    await pipeline.toFile(processedPath);
    
    console.log(`[OCR] Image preprocessed: ${imagePath} -> ${processedPath}`);
    return processedPath;
  } catch (error) {
    console.error(`[OCR] Preprocessing failed, using original image:`, error);
    return imagePath;
  }
}

/**
 * Clean up preprocessed image file
 */
function cleanupProcessedImage(processedPath: string, originalPath: string): void {
  if (processedPath !== originalPath && fs.existsSync(processedPath)) {
    try {
      fs.unlinkSync(processedPath);
    } catch (error) {
      console.error(`[OCR] Failed to cleanup processed image:`, error);
    }
  }
}

/**
 * Clean HTML email content and extract plain text
 * Handles common email receipt formats
 */
export function cleanEmailHtml(html: string): string {
  let text = html;
  
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n');
  text = text.replace(/<td[^>]*>/gi, ' | ');
  
  text = text.replace(/<[^>]+>/g, '');
  
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/&apos;/gi, "'");
  text = text.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)));
  
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.trim();
  
  return text;
}

/**
 * Parse email receipt text with enhanced patterns for email-specific formats
 * Handles order confirmations, digital receipts, etc.
 */
export function parseEmailReceiptText(rawText: string): ParsedReceipt {
  const isHtml = /<[a-z][\s\S]*>/i.test(rawText);
  const text = isHtml ? cleanEmailHtml(rawText) : rawText;
  
  const result: ParsedReceipt = {
    merchant: null,
    date: null,
    total: null,
    subtotal: null,
    taxAmount: null,
    vatAmount: null,
    vatSource: 'none',
    invoiceNumber: null,
    confidence: 'low',
    rawText: text,
    ocrConfidence: 100,
    policies: {
      returnPolicyDays: null,
      returnPolicyTerms: null,
      refundType: null,
      exchangePolicyDays: null,
      exchangePolicyTerms: null,
      warrantyMonths: null,
      warrantyTerms: null,
      policySource: 'merchant_default',
    },
    warnings: []
  };

  const emailMerchantPatterns = [
    /(?:order\s+from|thank\s+you\s+for\s+(?:your\s+)?(?:order|purchase)\s+(?:at|from|with))\s*[:\-]?\s*([A-Za-z0-9\s&'.-]+?)(?:\n|!|\.|\|)/i,
    /(?:receipt\s+from|your\s+receipt\s+from)\s*[:\-]?\s*([A-Za-z0-9\s&'.-]+?)(?:\n|$)/i,
    /(?:from|sender)[\s:]+([A-Za-z0-9\s&'.-]+?)(?:\s*<[^>]+>|\n|$)/i,
    /^([A-Z][A-Za-z0-9\s&'.-]{2,30})(?:\s+order|\s+receipt|\s+invoice|\n)/m,
    /(?:store|merchant|seller|shop|vendor)[\s:]+([A-Za-z0-9\s&'.-]+?)(?:\n|$)/i,
  ];

  for (const pattern of emailMerchantPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const merchant = match[1].trim();
      if (!merchant.match(/^(order|receipt|invoice|tax|date|time|total|subtotal|qty|item|price|confirmation|thank)/i) && merchant.length > 2) {
        result.merchant = merchant;
        break;
      }
    }
  }

  if (!result.merchant) {
    const parsed = parseReceiptText(text, 100);
    result.merchant = parsed.merchant;
  }

  // Invoice/Order number extraction for emails
  const emailInvoicePatterns = [
    // Order #12345, Order Number: 12345
    /(?:order)[\s#:\-.number]*([A-Z]{0,5}\d{5,20})/i,
    // Invoice #12345, Invoice Number: 12345
    /(?:invoice|inv)[\s#:\-.number]*([A-Z]{0,5}\d{5,20})/i,
    // Confirmation #12345
    /(?:confirmation)[\s#:\-.number]*([A-Z]{0,5}\d{5,20})/i,
    // Receipt #12345
    /(?:receipt|rcpt)[\s#:\-.no]*([A-Z]{0,5}\d{5,20})/i,
    // Transaction ID: 12345
    /(?:transaction|trans|txn)[\s#:\-.id]*([A-Z]{0,5}\d{5,20})/i,
    // Reference: 12345
    /(?:reference|ref)[\s#:\-]*([A-Z]{0,5}\d{5,20})/i,
  ];

  for (const pattern of emailInvoicePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const invoiceNum = match[1].trim();
      if (invoiceNum.length >= 5 && invoiceNum.length <= 25) {
        result.invoiceNumber = invoiceNum;
        break;
      }
    }
  }

  const emailDatePatterns = [
    { pattern: /(?:order\s+date|purchase\s+date|date\s+ordered|transaction\s+date)[\s:]+([^\n]+)/i, priority: 1 },
    { pattern: /(?:placed\s+on|ordered\s+on|purchased\s+on)[\s:]+([^\n]+)/i, priority: 1 },
    { pattern: /\b(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4})\b/, priority: 2 },
    { pattern: /\b(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2})\b/, priority: 2 },
    { pattern: /\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s+\d{4})\b/i, priority: 1 },
    { pattern: /\b((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i, priority: 1 },
    { pattern: /\b(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2})\b/, priority: 3 },
  ];

  const sortedDatePatterns = emailDatePatterns.sort((a, b) => a.priority - b.priority);
  for (const { pattern } of sortedDatePatterns) {
    const match = text.match(pattern);
    if (match) {
      let dateStr = match[1].trim();
      const internalDateMatch = dateStr.match(/(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/);
      if (internalDateMatch) {
        dateStr = internalDateMatch[1];
      }
      const monthDateMatch = dateStr.match(/((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s+\d{4})/i);
      if (monthDateMatch) {
        dateStr = monthDateMatch[1];
      }
      result.date = dateStr;
      break;
    }
  }

  const emailTotalPatterns = [
    /(?:order\s+total|grand\s+total|total\s+charged|amount\s+charged|you\s+paid|payment\s+total|total\s+amount|total\s+paid|amount\s+due|balance\s+due)[\s:]*[$£€¥₹R]?\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
    /^TOTAL[\s:]*[$£€¥₹R]?\s*(\d+[,\s]*\d*\.?\d{0,2})/im,
    /\bTOTAL[\s:]+[$£€¥₹R]?\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
    /[$£€¥₹R]\s*(\d+[,\s]*\d*\.\d{2})(?:\s+total|\s*$)/i,
    /(?:charged|paid|billed)[\s:]*[$£€¥₹R]?\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
  ];

  for (const pattern of emailTotalPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const matchedText = match[0].toLowerCase();
      if (matchedText.includes('subtotal') || matchedText.includes('sub-total') || matchedText.includes('sub total')) {
        continue;
      }
      const cleanNumber = match[1].replace(/[,\s]/g, '');
      const parsedTotal = parseFloat(cleanNumber);
      if (parsedTotal > 0 && parsedTotal < 1000000) {
        result.total = parsedTotal;
        break;
      }
    }
  }

  if (!result.total) {
    const parsed = parseReceiptText(text, 100);
    result.total = parsed.total;
  }

  // Extract subtotal (ex VAT amount)
  const subtotalPatterns = [
    /(?:subtotal|sub-total|sub\s+total)(?:\s*\(?\s*(?:ex|excl|excluding|before)\s*(?:vat|tax)\s*\)?\s*)?[\s:]*[$£€¥₹R]?\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
    /(?:net\s+amount|net\s+total|amount\s+ex\s*vat)[\s:]*[$£€¥₹R]?\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
  ];

  for (const pattern of subtotalPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const cleanNumber = match[1].replace(/[,\s]/g, '');
      const parsedSubtotal = parseFloat(cleanNumber);
      if (parsedSubtotal > 0 && parsedSubtotal < 1000000) {
        result.subtotal = parsedSubtotal;
        break;
      }
    }
  }

  // Extract VAT amount
  const vatPatterns = [
    // Standard VAT patterns (highest priority)
    /(?:vat|v\.a\.t\.?)(?:\s*\(?\s*\d+%?\s*\)?)?[\s:]*[$£€¥₹R]?\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
    /(?:value\s+added\s+tax)[\s:]*[$£€¥₹R]?\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
    /(?:vat\s+amount|vat\s+total)[\s:]*[$£€¥₹R]?\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
    // "Excl Vat" pattern - only match standalone lines (not subtotal lines)
    /^(?!.*(?:subtotal|sub-total|sub\s+total)).*(?:excl\.?\s*vat|excluding\s*vat)[\s:]*[$£€¥₹R]?\s*(\d+[,\s]*\d*\.?\d{0,2})/im,
  ];

  for (const pattern of vatPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const matchedText = match[0].toLowerCase();
      // Skip if this looks like a subtotal line
      if (matchedText.includes('subtotal') || matchedText.includes('sub-total') || matchedText.includes('sub total')) {
        continue;
      }
      const cleanNumber = match[1].replace(/[,\s]/g, '');
      const parsedVat = parseFloat(cleanNumber);
      if (parsedVat > 0 && parsedVat < 1000000) {
        result.vatAmount = parsedVat;
        result.vatSource = 'extracted';
        break;
      }
    }
  }

  // Extract general tax amount (for non-VAT jurisdictions)
  const taxPatterns = [
    /(?:tax|sales\s+tax|gst|hst)(?:\s*\(?\s*\d+%?\s*\)?)?[\s:]*[$£€¥₹R]?\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
  ];

  for (const pattern of taxPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const matchedText = match[0].toLowerCase();
      // Skip if it's actually VAT (already captured)
      if (matchedText.includes('vat') || matchedText.includes('v.a.t')) {
        continue;
      }
      const cleanNumber = match[1].replace(/[,\s]/g, '');
      const parsedTax = parseFloat(cleanNumber);
      if (parsedTax > 0 && parsedTax < 1000000) {
        result.taxAmount = parsedTax;
        break;
      }
    }
  }

  // VAT Calculation Logic (when not explicitly extracted)
  if (!result.vatAmount && result.total) {
    if (result.subtotal && result.subtotal < result.total) {
      // Calculate VAT = Total - Subtotal
      const calculatedVat = Math.round((result.total - result.subtotal) * 100) / 100;
      const vatPercentage = (calculatedVat / result.subtotal) * 100;
      if (vatPercentage >= 5 && vatPercentage <= 30) {
        result.vatAmount = calculatedVat;
        result.vatSource = 'calculated';
      }
    } else {
      // Calculate VAT at 15% from total
      const calculatedVat = Math.round((result.total / 1.15 * 0.15) * 100) / 100;
      result.vatAmount = calculatedVat;
      result.subtotal = Math.round((result.total - calculatedVat) * 100) / 100;
      result.vatSource = 'calculated';
    }
  }

  // If we have VAT but no subtotal, calculate it
  if (result.vatAmount && result.total && !result.subtotal) {
    result.subtotal = Math.round((result.total - result.vatAmount) * 100) / 100;
  }

  let confidenceScore = 0;
  const weights = { merchant: 0.3, date: 0.35, total: 0.35 };

  if (result.merchant) {
    const wordCount = result.merchant.split(/\s+/).length;
    confidenceScore += weights.merchant * Math.min(wordCount / 2, 1);
  }
  if (result.date) {
    confidenceScore += weights.date;
  }
  if (result.total) {
    const hasDecimals = result.total.toString().includes('.');
    confidenceScore += weights.total * (hasDecimals ? 1 : 0.7);
  }

  if (confidenceScore >= 0.8) {
    result.confidence = 'high';
  } else if (confidenceScore >= 0.5) {
    result.confidence = 'medium';
  } else {
    result.confidence = 'low';
  }

  const missingFields: string[] = [];
  if (!result.merchant) {
    result.merchantTODO = 'Could not detect merchant from email';
    missingFields.push('merchant name');
  }
  if (!result.date) {
    result.dateTODO = 'Could not detect date from email';
    missingFields.push('purchase date');
  }
  if (!result.total) {
    result.totalTODO = 'Could not detect total from email';
    missingFields.push('total amount');
  }

  if (missingFields.length > 0 && missingFields.length < 3) {
    result.warnings.push(`Could not detect: ${missingFields.join(', ')}`);
    result.error = {
      type: 'PARTIAL_EXTRACTION',
      ...OCR_ERRORS.PARTIAL_EXTRACTION
    };
  } else if (missingFields.length === 3) {
    result.error = {
      type: 'NO_TEXT_DETECTED',
      message: "Could not extract receipt information from the email",
      suggestion: "Make sure you've pasted the full email content. The email should contain order details with merchant, date, and total.",
      canRetry: true
    };
  }

  return result;
}

// Error types for better user feedback
export type OCRErrorType = 
  | 'NO_TEXT_DETECTED'
  | 'LOW_QUALITY_IMAGE'
  | 'PROCESSING_FAILED'
  | 'INVALID_FORMAT'
  | 'PARTIAL_EXTRACTION';

export interface OCRError {
  type: OCRErrorType;
  message: string;
  suggestion: string;
  canRetry: boolean;
}

export const OCR_ERRORS: Record<OCRErrorType, Omit<OCRError, 'type'>> = {
  NO_TEXT_DETECTED: {
    message: "No text was detected in the image",
    suggestion: "Make sure the receipt is clearly visible, well-lit, and not blurry. Try placing it on a dark, contrasting surface.",
    canRetry: true
  },
  LOW_QUALITY_IMAGE: {
    message: "The image quality is too low for accurate scanning",
    suggestion: "Use better lighting, hold the camera steady, and ensure the receipt is in focus. Avoid shadows and glare.",
    canRetry: true
  },
  PROCESSING_FAILED: {
    message: "Something went wrong while processing the receipt",
    suggestion: "Please try again. If the problem persists, you can enter the details manually.",
    canRetry: true
  },
  INVALID_FORMAT: {
    message: "The file format is not supported",
    suggestion: "Please upload a JPEG, PNG, or PDF file.",
    canRetry: false
  },
  PARTIAL_EXTRACTION: {
    message: "Some receipt details couldn't be read automatically",
    suggestion: "The fields that couldn't be detected are highlighted. Please fill them in manually.",
    canRetry: false
  }
};

interface PolicyInfo {
  returnPolicyDays: number | null;
  returnPolicyTerms: string | null;
  refundType: 'full' | 'store_credit' | 'exchange_only' | 'partial' | 'none' | null;
  exchangePolicyDays: number | null;
  exchangePolicyTerms: string | null;
  warrantyMonths: number | null;
  warrantyTerms: string | null;
  policySource: 'extracted' | 'user_entered' | 'merchant_default';
}

interface ParsedReceipt {
  merchant: string | null;
  date: string | null;
  total: number | null;
  subtotal: number | null;
  taxAmount: number | null;
  vatAmount: number | null;
  vatSource: 'extracted' | 'calculated' | 'none';
  invoiceNumber: string | null;
  confidence: 'low' | 'medium' | 'high';
  rawText: string;
  ocrConfidence: number;
  // Policy information extracted from receipt
  policies: PolicyInfo;
  merchantTODO?: string;
  dateTODO?: string;
  totalTODO?: string;
  error?: OCRError;
  warnings: string[];
}

interface OCRResult {
  text: string;
  confidence: number;
  error?: OCRError;
}

/**
 * Extract text from receipt image using OCR
 * Applies preprocessing for better accuracy on mobile photos
 * @param imagePath - Path to uploaded image
 * @returns Extracted text with confidence score
 */
export async function performOCR(imagePath: string): Promise<OCRResult> {
  let processedPath = imagePath;
  
  try {
    processedPath = await preprocessImage(imagePath);
    console.log(`[OCR] Starting recognition on: ${processedPath}`);
    
    const result = await Tesseract.recognize(processedPath, 'eng', {
      logger: (info: any) => {
        if (info.status === 'recognizing text') {
          console.log(`[OCR] Progress: ${Math.round(info.progress * 100)}%`);
        }
      }
    });
    
    const text = result.data.text.trim();
    const confidence = result.data.confidence;
    
    console.log(`[OCR] Recognition complete. Confidence: ${confidence}%, Text length: ${text.length}`);
    
    if (!text || text.length < 10) {
      return {
        text: '',
        confidence: 0,
        error: {
          type: 'NO_TEXT_DETECTED',
          ...OCR_ERRORS.NO_TEXT_DETECTED
        }
      };
    }
    
    if (confidence < 30) {
      return {
        text,
        confidence,
        error: {
          type: 'LOW_QUALITY_IMAGE',
          ...OCR_ERRORS.LOW_QUALITY_IMAGE
        }
      };
    }
    
    return { text, confidence };
  } catch (error) {
    console.error('[OCR] Recognition failed:', error);
    return {
      text: '',
      confidence: 0,
      error: {
        type: 'PROCESSING_FAILED',
        ...OCR_ERRORS.PROCESSING_FAILED
      }
    };
  } finally {
    cleanupProcessedImage(processedPath, imagePath);
  }
}

/**
 * Parse receipt text to extract merchant, date, and total
 * Uses regex and heuristics with fallback handling
 * @param text - OCR extracted text
 * @param ocrConfidence - Confidence score from OCR (0-100)
 * @returns Parsed receipt data
 */
export function parseReceiptText(text: string, ocrConfidence: number = 0): ParsedReceipt {
  const result: ParsedReceipt = {
    merchant: null,
    date: null,
    total: null,
    subtotal: null,
    taxAmount: null,
    vatAmount: null,
    vatSource: 'none',
    invoiceNumber: null,
    confidence: 'low',
    rawText: text,
    ocrConfidence,
    policies: {
      returnPolicyDays: null,
      returnPolicyTerms: null,
      refundType: null,
      exchangePolicyDays: null,
      exchangePolicyTerms: null,
      warrantyMonths: null,
      warrantyTerms: null,
      policySource: 'merchant_default',
    },
    warnings: []
  };

  // Enhanced merchant detection
  // Priority order: company names, explicit merchant indicators, first significant line
  const merchantPatterns = [
    // Company names with suffixes (CC, PTY, LTD, INC, LLC, etc.)
    /^([A-Z][A-Za-z0-9\s&'.-]+(?:\s+(?:CC|PTY|LTD|INC|LLC|PLC|CO|CORP|LIMITED|INCORPORATED))\.?)/im,
    // Company names with & in them (e.g., "BRICK PARADISE & HARDWARE")
    /^([A-Z][A-Z0-9\s]+&\s*[A-Z][A-Z0-9\s]+)(?:\s+(?:CC|PTY|LTD|INC|LLC|PLC|CO|CORP|LIMITED)?\.?)?/m,
    // All caps company names at the top (common on receipts)
    /^([A-Z][A-Z0-9\s&'.-]{5,40})(?:\n)/m,
    // Explicit patterns with keywords
    /(?:from|at|@|merchant|store|shop|vendor)[\s:]+([A-Za-z0-9\s&'.-]+?)(?:\n|receipt|invoice|$)/i,
    // Common merchant name formats (often in caps or title case at top)
    /^([A-Z][A-Za-z\s&'.-]{2,30})(?:\n|receipt|invoice)/m,
    // Fallback: first non-empty line with reasonable length
    /^([A-Za-z0-9\s&'.-]{3,40})(?:\n|$)/
  ];

  for (const pattern of merchantPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const merchant = match[1].trim();
      // Filter out common non-merchant lines and generic headers
      if (!merchant.match(/^(receipt|invoice|tax|date|time|total|subtotal|qty|item|price|customer|vat|no\s*collections|terms|conditions|intersection)/i) 
          && merchant.length >= 3) {
        result.merchant = merchant;
        break;
      }
    }
  }

  // Invoice/Receipt number extraction
  const invoicePatterns = [
    // Invoice #IN57937966 - alphanumeric invoice numbers with prefix (5+ digits)
    /(?:invoice|inv)[\s#:\-]*([A-Z]{1,5}\d{5,15})/i,
    // Invoice #12345, INV-12345 - numeric only (5+ digits)
    /(?:invoice|inv)[\s#:\-]*(\d{5,15})/i,
    // Receipt No. 12345, Receipt #12345
    /(?:receipt|rcpt)[\s#:\-.no]*([A-Z]{0,3}\d{5,15})/i,
    // Tax Invoice: 12345
    /(?:tax\s+invoice)[\s#:\-]*([A-Z]{0,3}\d{5,15})/i,
    // Order #12345, Order No. 12345
    /(?:order)[\s#:\-.no]*([A-Z]{0,3}\d{5,15})/i,
    // Transaction ID: 12345
    /(?:transaction|trans|txn)[\s#:\-.id]*([A-Z]{0,3}\d{5,15})/i,
    // Reference: 12345, Ref #12345
    /(?:reference|ref)[\s#:\-]*([A-Z]{0,3}\d{5,15})/i,
    // TM: 7 TX: 35933 (South African format)
    /\bTX[\s:]*(\d{4,10})\b/i,
    // Doc No: 12345
    /(?:doc|document)[\s#:\-.no]*([A-Z]{0,3}\d{5,15})/i,
  ];

  for (const pattern of invoicePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const invoiceNum = match[1].trim();
      // Validate: should be at least 5 chars and not look like a phone number or date
      if (invoiceNum.length >= 5 && invoiceNum.length <= 20) {
        // Skip if it looks like a phone number (starts with 0 and has 10+ digits)
        if (/^0\d{9,}$/.test(invoiceNum)) continue;
        // Skip if it looks like a date
        if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(invoiceNum)) continue;
        result.invoiceNumber = invoiceNum;
        break;
      }
    }
  }

  // Enhanced date extraction with more formats
  const datePatterns = [
    // DD/MM/YYYY or MM/DD/YYYY with various separators
    { pattern: /\b(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4})\b/, priority: 1 },
    { pattern: /\b(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2})\b/, priority: 2 },
    // YYYY-MM-DD (ISO format)
    { pattern: /\b(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2})\b/, priority: 1 },
    // Month name formats (Dec 25, 2024 or 25 Dec 2024)
    { pattern: /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i, priority: 1 },
    { pattern: /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i, priority: 1 },
    // Short month format (1 Jan 24)
    { pattern: /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2})\b/i, priority: 2 }
  ];

  // Try patterns in priority order
  const sortedDatePatterns = datePatterns.sort((a, b) => a.priority - b.priority);
  for (const { pattern } of sortedDatePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.date = match[1];
      break;
    }
  }

  // Enhanced total extraction with contextual awareness
  const totalPatterns = [
    // Explicit TOTAL label (not subtotal)
    /^TOTAL[\s:]*[$£€¥₹KES]*\s*(\d+[,\s]*\d*\.?\d{0,2})/im,
    /\bTOTAL[\s:]+[$£€¥₹KES]*\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
    // Standard total with currency symbols and decimal
    /(?:grand\s*total|amount\s*due|balance\s*due|total\s*due)[\s:]*[$£€¥₹KES]*\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
    // Total without explicit label but with currency
    /[$£€¥₹]\s*(\d+[,\s]*\d*\.\d{2})\s*(?:\n|$)/,
    // Total with KES or other currency codes
    /(?:total|amount)[\s:]*(\d+[,\s]*\d*\.?\d{0,2})\s*(?:KES|USD|GBP|EUR)/i,
    // Standalone total near end of receipt
    /(?:^|\n)\s*(\d+[,\s]*\d*\.\d{2})\s*(?:\n|$)/,
    // Total without decimals (whole amounts)
    /(?:total|amount)[\s:]*[$£€¥₹KES]*\s*(\d+)\s*(?:only|\/=|$)/i
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Skip subtotal matches
      const matchedText = match[0].toLowerCase();
      if (matchedText.includes('subtotal') || matchedText.includes('sub-total') || matchedText.includes('sub total')) {
        continue;
      }
      // Clean up the number (remove commas, spaces)
      const cleanNumber = match[1].replace(/[,\s]/g, '');
      const parsedTotal = parseFloat(cleanNumber);
      
      // Sanity check: total should be positive and reasonable (< 1 million)
      if (parsedTotal > 0 && parsedTotal < 1000000) {
        result.total = parsedTotal;
        break;
      }
    }
  }

  // Extract subtotal (ex VAT amount)
  const subtotalPatterns = [
    /(?:subtotal|sub-total|sub\s+total)(?:\s*\(?\s*(?:ex|excl|excluding|before)\s*(?:vat|tax)\s*\)?\s*)?[\s:]*[$£€¥₹KES]*\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
    /(?:net\s+amount|net\s+total|amount\s+ex\s*vat)[\s:]*[$£€¥₹KES]*\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
  ];

  for (const pattern of subtotalPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const cleanNumber = match[1].replace(/[,\s]/g, '');
      const parsedSubtotal = parseFloat(cleanNumber);
      if (parsedSubtotal > 0 && parsedSubtotal < 1000000) {
        result.subtotal = parsedSubtotal;
        break;
      }
    }
  }

  // Extract VAT amount - handle various formats
  // Note: "Excl Vat: 28.65" on SA receipts can mean the VAT amount (standalone line, not part of subtotal)
  const vatPatterns = [
    // Standard VAT patterns (highest priority)
    /(?:vat|v\.a\.t\.?)(?:\s*\(?\s*\d+%?\s*\)?)?[\s:]*[$£€¥₹RKES]*\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
    /(?:value\s+added\s+tax)[\s:]*[$£€¥₹RKES]*\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
    /(?:vat\s+amount|vat\s+total)[\s:]*[$£€¥₹RKES]*\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
    // 15% VAT indicator
    /(?:15%\s*vat|vat\s*15%)[\s:]*[$£€¥₹RKES]*\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
    // "Excl Vat: 28.65" - standalone line (not part of subtotal)
    // Only match if NOT preceded by subtotal/sub-total/sub total
    /^(?!.*(?:subtotal|sub-total|sub\s+total)).*(?:excl\.?\s*vat|excluding\s*vat)[\s:]*[$£€¥₹RKES]*\s*(\d+[,\s]*\d*\.?\d{0,2})/im,
  ];

  for (const pattern of vatPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const matchedText = match[0].toLowerCase();
      // Skip if this looks like a subtotal line
      if (matchedText.includes('subtotal') || matchedText.includes('sub-total') || matchedText.includes('sub total')) {
        continue;
      }
      const cleanNumber = match[1].replace(/[,\s]/g, '');
      const parsedVat = parseFloat(cleanNumber);
      if (parsedVat > 0 && parsedVat < 1000000) {
        result.vatAmount = parsedVat;
        result.vatSource = 'extracted';
        break;
      }
    }
  }

  // Extract general tax amount (for non-VAT jurisdictions like US sales tax)
  const taxPatterns = [
    /(?:sales\s+tax|tax)(?:\s*\(?\s*\d+%?\s*\)?)?[\s:]*[$£€¥₹RKES]*\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
    /(?:gst|hst|pst)(?:\s*\(?\s*\d+%?\s*\)?)?[\s:]*[$£€¥₹RKES]*\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
  ];

  for (const pattern of taxPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const matchedText = match[0].toLowerCase();
      // Skip if it's VAT (already captured)
      if (matchedText.includes('vat') || matchedText.includes('v.a.t')) {
        continue;
      }
      const cleanNumber = match[1].replace(/[,\s]/g, '');
      const parsedTax = parseFloat(cleanNumber);
      if (parsedTax > 0 && parsedTax < 1000000) {
        result.taxAmount = parsedTax;
        break;
      }
    }
  }

  // VAT Calculation Logic (when not explicitly extracted)
  // Priority: 1) Extracted VAT, 2) Calculate from subtotal, 3) Calculate at 15% from total
  if (!result.vatAmount && result.total) {
    if (result.subtotal && result.subtotal < result.total) {
      // Calculate VAT = Total - Subtotal
      const calculatedVat = Math.round((result.total - result.subtotal) * 100) / 100;
      // Validate: VAT should be reasonable (typically 5-25% of subtotal)
      const vatPercentage = (calculatedVat / result.subtotal) * 100;
      if (vatPercentage >= 5 && vatPercentage <= 30) {
        result.vatAmount = calculatedVat;
        result.vatSource = 'calculated';
      }
    } else {
      // Calculate VAT at 15% (standard SA rate) from total
      // Formula: VAT = Total / 1.15 * 0.15 (extracting VAT from VAT-inclusive total)
      const calculatedVat = Math.round((result.total / 1.15 * 0.15) * 100) / 100;
      result.vatAmount = calculatedVat;
      result.subtotal = Math.round((result.total - calculatedVat) * 100) / 100;
      result.vatSource = 'calculated';
    }
  }

  // If we have VAT but no subtotal, calculate it
  if (result.vatAmount && result.total && !result.subtotal) {
    result.subtotal = Math.round((result.total - result.vatAmount) * 100) / 100;
  }

  // ============================================
  // POLICY EXTRACTION (Return/Refund/Exchange/Warranty)
  // ============================================
  
  // Return policy patterns (extract days and terms)
  const returnPatterns = [
    // "30 day return policy", "returns within 30 days"
    /(\d+)\s*(?:day|days)\s*(?:return|refund)\s*(?:policy|period)?/i,
    /return(?:s)?\s*(?:within|accepted|policy)?\s*(?:within)?\s*(\d+)\s*days?/i,
    /(?:return\s+period|refund\s+period)[\s:]*(\d+)\s*days?/i,
    // "no returns after 14 days"
    /no\s+returns?\s+after\s+(\d+)\s*days?/i,
    // "7 day money back"
    /(\d+)\s*day\s*money\s*back/i,
  ];
  
  for (const pattern of returnPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const days = parseInt(match[1], 10);
      if (days > 0 && days <= 365) {
        result.policies.returnPolicyDays = days;
        result.policies.returnPolicyTerms = match[0].trim();
        result.policies.policySource = 'extracted';
        break;
      }
    }
  }

  // Exchange policy patterns
  const exchangePatterns = [
    /(\d+)\s*(?:day|days)\s*(?:exchange|swap)\s*(?:policy|period)?/i,
    /exchange(?:s)?\s*(?:within|accepted|only)?\s*(?:within)?\s*(\d+)\s*days?/i,
    /exchange\s+only/i,
    /no\s+exchange(?:s)?/i,
  ];
  
  for (const pattern of exchangePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1]) {
        const days = parseInt(match[1], 10);
        if (days > 0 && days <= 365) {
          result.policies.exchangePolicyDays = days;
          result.policies.exchangePolicyTerms = match[0].trim();
          result.policies.policySource = 'extracted';
        }
      } else {
        // "exchange only" or "no exchanges"
        result.policies.exchangePolicyTerms = match[0].trim();
        result.policies.policySource = 'extracted';
      }
      break;
    }
  }

  // Refund type patterns
  const refundPatterns = [
    { pattern: /(?:full\s+refund|money\s+back\s+guarantee|100%\s+refund)/i, type: 'full' as const },
    { pattern: /(?:store\s+credit|credit\s+only|in-?store\s+credit)/i, type: 'store_credit' as const },
    { pattern: /(?:exchange\s+only|swap\s+only|no\s+(?:cash\s+)?refund)/i, type: 'exchange_only' as const },
    { pattern: /(?:partial\s+refund|restocking\s+fee)/i, type: 'partial' as const },
    { pattern: /(?:no\s+refund|final\s+sale|all\s+sales?\s+final)/i, type: 'none' as const },
  ];
  
  for (const { pattern, type } of refundPatterns) {
    if (pattern.test(text)) {
      result.policies.refundType = type;
      result.policies.policySource = 'extracted';
      break;
    }
  }

  // Warranty patterns (extract months/years)
  const warrantyPatterns = [
    // "1 year warranty", "12 month warranty"
    /(\d+)\s*(?:year|yr)s?\s*warranty/i,
    /warranty[\s:]*(\d+)\s*(?:year|yr)s?/i,
    /(\d+)\s*(?:month|mo)s?\s*warranty/i,
    /warranty[\s:]*(\d+)\s*(?:month|mo)s?/i,
    // "lifetime warranty"
    /lifetime\s*warranty/i,
    // "warranty expires", "warranty until"
    /warranty\s+(?:expires?|until|valid\s+(?:for|until))/i,
    // "manufacturer warranty", "factory warranty"  
    /(?:manufacturer|factory|limited)\s+warranty/i,
  ];
  
  for (const pattern of warrantyPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[0].toLowerCase().includes('lifetime')) {
        result.policies.warrantyMonths = 120; // 10 years as "lifetime"
        result.policies.warrantyTerms = 'Lifetime warranty';
        result.policies.policySource = 'extracted';
      } else if (match[1]) {
        const value = parseInt(match[1], 10);
        if (value > 0) {
          // Check if it's years or months
          const isYears = match[0].toLowerCase().includes('year') || match[0].toLowerCase().includes('yr');
          result.policies.warrantyMonths = isYears ? value * 12 : value;
          result.policies.warrantyTerms = match[0].trim();
          result.policies.policySource = 'extracted';
        }
      } else {
        // General warranty mention without duration
        result.policies.warrantyTerms = match[0].trim();
        result.policies.policySource = 'extracted';
      }
      break;
    }
  }

  // Improved confidence scoring with weighted factors
  let confidenceScore = 0;
  const weights = {
    merchant: 0.3,
    date: 0.35,
    total: 0.35
  };

  if (result.merchant) {
    // Higher confidence for merchants with more than one word
    const wordCount = result.merchant.split(/\s+/).length;
    confidenceScore += weights.merchant * Math.min(wordCount / 2, 1);
  }
  
  if (result.date) {
    // Higher confidence for standard date formats
    confidenceScore += weights.date;
  }
  
  if (result.total) {
    // Higher confidence for totals with decimals
    const hasDecimals = result.total.toString().includes('.');
    confidenceScore += weights.total * (hasDecimals ? 1 : 0.7);
  }

  // Set confidence level based on score
  if (confidenceScore >= 0.8) {
    result.confidence = 'high' as const;
  } else if (confidenceScore >= 0.5) {
    result.confidence = 'medium' as const;
  } else {
    result.confidence = 'low' as const;
  }

  return result;
}

/**
 * Full OCR pipeline: perform OCR and parse results
 * @param imagePath - Path to uploaded image
 * @returns Parsed receipt data
 */
export async function processReceipt(imagePath: string): Promise<ParsedReceipt> {
  const ocrResult = await performOCR(imagePath);
  
  // Handle OCR errors
  if (ocrResult.error) {
    return {
      merchant: null,
      date: null,
      total: null,
      subtotal: null,
      taxAmount: null,
      vatAmount: null,
      vatSource: 'none',
      invoiceNumber: null,
      confidence: 'low',
      rawText: ocrResult.text,
      ocrConfidence: ocrResult.confidence,
      policies: {
        returnPolicyDays: null,
        returnPolicyTerms: null,
        refundType: null,
        exchangePolicyDays: null,
        exchangePolicyTerms: null,
        warrantyMonths: null,
        warrantyTerms: null,
        policySource: 'merchant_default',
      },
      error: ocrResult.error,
      warnings: []
    };
  }
  
  const parsed = parseReceiptText(ocrResult.text, ocrResult.confidence);
  
  // Add TODO flags and warnings for missing fields
  const missingFields: string[] = [];
  
  if (!parsed.merchant) {
    parsed.merchantTODO = 'Manual entry required - OCR could not detect merchant';
    missingFields.push('merchant name');
  }
  if (!parsed.date) {
    parsed.dateTODO = 'Manual entry required - OCR could not detect date';
    missingFields.push('purchase date');
  }
  if (!parsed.total) {
    parsed.totalTODO = 'Manual entry required - OCR could not detect total';
    missingFields.push('total amount');
  }
  
  // Add partial extraction error if some fields are missing
  if (missingFields.length > 0 && missingFields.length < 3) {
    parsed.warnings.push(`Could not detect: ${missingFields.join(', ')}`);
    parsed.error = {
      type: 'PARTIAL_EXTRACTION',
      ...OCR_ERRORS.PARTIAL_EXTRACTION
    };
  } else if (missingFields.length === 3) {
    // All fields missing despite having text
    parsed.error = {
      type: 'LOW_QUALITY_IMAGE',
      ...OCR_ERRORS.LOW_QUALITY_IMAGE
    };
    parsed.warnings.push('No receipt information could be extracted from the image');
  }

  return parsed;
}
