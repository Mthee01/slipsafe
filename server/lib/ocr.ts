/**
 * OCR and receipt parsing helpers
 * Uses Gemini Vision AI as primary OCR for best accuracy
 * Falls back to Tesseract.js if Gemini is unavailable
 * Also handles email receipt text parsing
 * Includes Sharp-based image preprocessing for improved OCR accuracy
 */

import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { performGeminiOCR, isGeminiAvailable } from './gemini-ocr';

/**
 * Preprocess image for better OCR accuracy
 * Applies: grayscale, adaptive thresholding (binarization), noise reduction, and scaling
 * Optimized for receipt paper with thermal printing
 * @param imagePath - Path to the original image
 * @returns Path to the preprocessed image
 */
async function preprocessImage(imagePath: string): Promise<string> {
  const ext = path.extname(imagePath);
  const baseName = path.basename(imagePath, ext);
  const dir = path.dirname(imagePath);
  const processedPath = path.join(dir, `${baseName}_processed.png`); // Always output PNG for better quality
  
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    // Step 1: Auto-rotate based on EXIF, convert to grayscale
    let pipeline = image
      .rotate() // Auto-rotate based on EXIF
      .grayscale();
    
    // Step 2: Scale up images for better OCR (larger text = better recognition)
    // Scale more aggressively - up to 3x for small images
    if (metadata.width && metadata.width < 3000) {
      const scale = Math.min(3.0, 3000 / metadata.width);
      pipeline = pipeline.resize({
        width: Math.round(metadata.width * scale),
        kernel: 'lanczos3',
        withoutEnlargement: false
      });
      console.log(`[OCR] Scaling image from ${metadata.width}px to ${Math.round(metadata.width * scale)}px (${scale.toFixed(2)}x)`);
    }
    
    // Step 3: Normalize brightness/contrast to handle varying lighting
    pipeline = pipeline.normalize();
    
    // Step 4: Light contrast enhancement (no aggressive thresholding - it destroys text)
    // Just enhance contrast slightly to make text stand out
    pipeline = pipeline.linear(1.2, -20); // Slight contrast boost
    
    // Step 5: Light sharpening to make text edges clearer
    pipeline = pipeline.sharpen({ sigma: 0.3 });
    
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
    
    // Configure Tesseract for receipt scanning:
    // - PSM 6: Assume single uniform block of text (best for receipts)
    // - preserve_interword_spaces: Keep word spacing intact
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
    console.log(`[OCR] Raw text preview (first 500 chars):`, text.substring(0, 500));
    
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
    
    // Only reject extremely low quality images (10% threshold)
    // Most legitimate receipts should pass this, even with poor lighting
    if (confidence < 10) {
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
  // Priority order: business keywords first, then company suffixes, then other patterns
  // Important: Filter out OCR noise, product codes, addresses, and policy text
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Look for company names in the first 15 lines of the receipt (header area)
  const headerLines = lines.slice(0, 15);
  
  // Pattern to identify product codes and SKUs (should be filtered out)
  const productCodePattern = /^[A-Z]{1,3}[-]?[A-Z0-9]{5,}/;
  const addressPattern = /\b(intersection|street|road|avenue|blvd|drive|way|fourways|jhb|johannesburg|cape\s*town|durban|pretoria)\b/i;
  const numericHeavyPattern = /\d{5,}/; // Lines with long numbers (phone, VAT numbers, etc.)
  
  // Filter function to check if a line looks like a valid store name
  const isValidStoreName = (line: string): boolean => {
    const cleanLine = line.trim();
    // Must be at least 5 characters
    if (cleanLine.length < 5) return false;
    // Filter out product codes
    if (productCodePattern.test(cleanLine)) return false;
    // Filter out addresses
    if (addressPattern.test(cleanLine)) return false;
    // Filter out lines with long numbers
    if (numericHeavyPattern.test(cleanLine)) return false;
    // Filter out common non-merchant lines
    if (/^(receipt|invoice|tax|date|time|total|subtotal|qty|item|price|customer|vat|no\s*collect|terms|conditions|description|your\s+cashier|collect|card\s+details)/i.test(cleanLine)) return false;
    // Should have mostly letters (not numbers or special chars)
    const letterCount = (cleanLine.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < cleanLine.length * 0.5) return false;
    // Filter out OCR noise - lines with too many special characters
    const specialCharCount = (cleanLine.match(/[|=><\[\]{}()\\\/\"\':;,!@#$%^*~`_+]/g) || []).length;
    if (specialCharCount > 2) return false;
    // Filter out lines with repeated punctuation (OCR artifacts)
    if (/[.]{3,}|[-]{3,}|[_]{3,}/.test(cleanLine)) return false;
    return true;
  };
  
  // Priority 1 (FIRST!): Look for lines with common business keywords like HARDWARE, STORE, SHOP, etc.
  // This catches "BRICK PARADISE HARDWARE CC" even if OCR messed up some letters
  const businessKeywords = /\b(HARDWARE|STORE|SHOP|MARKET|SUPERMARKET|PHARMACY|BAKERY|RESTAURANT|CAFE|GARAGE|MOTORS|AUTO|ELECTRONICS|FURNITURE|CLOTHING|PARADISE|BUILDERS|BUILDING|SUPPLIES|WHOLESALE|RETAIL|CENTRE|CENTER|MALL|PLAZA)\b/i;
  for (const line of headerLines) {
    if (businessKeywords.test(line) && isValidStoreName(line) && line.length >= 8) {
      // Clean up OCR artifacts: remove extra spaces, trailing pipes, etc.
      let cleanedMerchant = line.replace(/\s+/g, ' ').replace(/[|\\\/]+$/g, '').trim();
      // If line ends with CC, PTY, LTD, etc., use up to that point
      const suffixMatch = cleanedMerchant.match(/^(.+?\s+(?:CC|PTY|LTD|INC|LLC|PLC|CO|CORP|LIMITED|INCORPORATED|Cl))\b/i);
      if (suffixMatch) {
        cleanedMerchant = suffixMatch[1];
      }
      result.merchant = cleanedMerchant.trim();
      console.log(`[OCR] Found merchant with business keyword: "${result.merchant}" from line: "${line}"`);
      break;
    }
  }
  
  // Priority 2: Look for company names with suffixes (CC, PTY, LTD, etc.)
  if (!result.merchant) {
    for (const line of headerLines) {
      const match = line.match(/^([A-Z][A-Za-z0-9\s&'.-]+(?:\s+(?:CC|PTY|LTD|INC|LLC|PLC|CO|CORP|LIMITED|INCORPORATED))\.?)/i);
      if (match && match[1] && isValidStoreName(match[1])) {
        result.merchant = match[1].trim();
        console.log(`[OCR] Found merchant with company suffix: "${result.merchant}"`);
        break;
      }
    }
  }
  
  // Priority 3: Look for all-caps lines with & in them (e.g., "BRICK PARADISE & HARDWARE")
  if (!result.merchant) {
    for (const line of headerLines) {
      if (line.includes('&') && /^[A-Z\s&]+$/.test(line) && line.length >= 10 && isValidStoreName(line)) {
        result.merchant = line.trim();
        console.log(`[OCR] Found merchant with &: "${result.merchant}"`);
        break;
      }
    }
  }
  
  // Priority 4: Look for all-caps store names (common on receipts)
  if (!result.merchant) {
    for (const line of headerLines) {
      // All caps, at least 8 chars, mostly letters
      if (/^[A-Z][A-Z\s&'.-]{7,}$/.test(line) && isValidStoreName(line)) {
        result.merchant = line.trim();
        console.log(`[OCR] Found merchant (all caps): "${result.merchant}"`);
        break;
      }
    }
  }
  
  // Priority 5: First significant line that looks like a store name
  if (!result.merchant) {
    for (const line of headerLines) {
      if (isValidStoreName(line) && line.length >= 8) {
        result.merchant = line.trim();
        console.log(`[OCR] Found merchant (first valid line): "${result.merchant}"`);
        break;
      }
    }
  }

  // Invoice/Receipt number extraction - LINE-BASED approach
  // User feedback: Look for "inv", "invoice" keywords and extract number from the SAME LINE
  const allLines = text.split(/\n/);
  
  // First pass: Find lines containing invoice/inv keyword and extract number from same line
  for (const line of allLines) {
    const lowerLine = line.toLowerCase();
    
    // Check if line contains invoice keyword
    if (lowerLine.includes('invoice') || lowerLine.includes('inv ') || lowerLine.includes('inv:') || lowerLine.includes('inv#')) {
      // Extract alphanumeric invoice number from this line
      // Handle formats like: #IN57937966, IN57937966, INV-12345, #INS 7937966 (with space), 12345678
      
      // Try 1: Alphanumeric with optional space between prefix and number
      // Example: "#INS 7937966" -> "INS7937966" or "#IN57937966" -> "IN57937966"
      let invoiceMatch = line.match(/[#]?([A-Z]{1,5})\s*(\d{5,15})/i);
      if (invoiceMatch && invoiceMatch[1] && invoiceMatch[2]) {
        const invoiceNum = (invoiceMatch[1] + invoiceMatch[2]).trim();
        if (invoiceNum.length >= 5 && invoiceNum.length <= 20) {
          if (!/^0\d{9,}$/.test(invoiceNum) && !/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(invoiceNum)) {
            result.invoiceNumber = invoiceNum;
            console.log(`[OCR] Found invoice number (prefix+number): ${invoiceNum} from line: "${line}"`);
            break;
          }
        }
      }
      
      // Try 2: Just numeric (if no prefix found)
      if (!result.invoiceNumber) {
        invoiceMatch = line.match(/\b(\d{6,15})\b/);
        if (invoiceMatch && invoiceMatch[1]) {
          const invoiceNum = invoiceMatch[1].trim();
          if (invoiceNum.length >= 6 && invoiceNum.length <= 20) {
            if (!/^0\d{9,}$/.test(invoiceNum) && !/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(invoiceNum)) {
              result.invoiceNumber = invoiceNum;
              console.log(`[OCR] Found invoice number (numeric only): ${invoiceNum} from line: "${line}"`);
              break;
            }
          }
        }
      }
    }
  }
  
  // Fallback patterns if line-based search didn't find anything
  if (!result.invoiceNumber) {
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
  // Handle various formats: "Total : 219.65", "Total: R219.65", "TOTAL 219.65"
  const totalPatterns = [
    // "Total : 219.65" or "Total: 219.65" with optional spaces around colon
    /\bTOTAL\s*:\s*[$£€¥₹RKES]*\s*[-]?(\d+[,\s]*\d*\.?\d{0,2})/i,
    // Explicit TOTAL label at start of line
    /^TOTAL[\s:]*[$£€¥₹RKES]*\s*[-]?(\d+[,\s]*\d*\.?\d{0,2})/im,
    // TOTAL followed by amount (no colon)
    /\bTOTAL\s+[$£€¥₹RKES]*\s*[-]?(\d+[,\s]*\d*\.?\d{0,2})/i,
    // Grand total, amount due, balance due
    /(?:grand\s*total|amount\s*due|balance\s*due|total\s*due|total\s*amount)[\s:]*[$£€¥₹RKES]*\s*[-]?(\d+[,\s]*\d*\.?\d{0,2})/i,
    // "Card :" or "Card:" followed by amount (payment method line)
    /\bCard\s*:\s*[$£€¥₹RKES]*\s*[-]?(\d+[,\s]*\d*\.?\d{0,2})/i,
    // "Cash :" or "Cash:" followed by amount
    /\bCash\s*:\s*[$£€¥₹RKES]*\s*[-]?(\d+[,\s]*\d*\.?\d{0,2})/i,
    // R219.65 format (South African Rand with R prefix)
    /\bR\s*(\d+[,\s]*\d*\.\d{2})/,
    // Total with currency codes after
    /(?:total|amount)[\s:]*(\d+[,\s]*\d*\.?\d{0,2})\s*(?:KES|USD|GBP|EUR|ZAR)/i,
    // Amount without decimals followed by "only" or "/="
    /(?:total|amount)[\s:]*[$£€¥₹RKES]*\s*(\d+)\s*(?:only|\/=|$)/i
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
  // Enhanced to catch common South African receipt formats like:
  // "NO COLECTIONS, NO EXCHANGES, NO REFUNDS, WITHOUT ORIGINAL INVOICE"
  // "MINIMUM HANDLING CHARGE OF 15% ON ALL RETURNS/EXCHANGES"
  
  // First, extract the full policy text block (usually at bottom of receipt)
  let policyTextBlock = '';
  const policyBlockPatterns = [
    // Look for policy sections that start with common keywords
    /(?:NO\s+(?:COLECTIONS?|COLLECTIONS?|EXCHANGES?|REFUNDS?)[^\n]*(?:\n[^\n]*){0,5})/gi,
    /(?:RETURN|REFUND|EXCHANGE|WARRANTY)[^\n]*(?:POLICY|TERMS|CONDITIONS)[^\n]*/gi,
    /(?:TERMS\s+(?:&|AND)\s+CONDITIONS)[^\n]*(?:\n[^\n]*){0,5}/gi,
    /(?:GOODS\s+ONCE\s+SOLD)[^\n]*/gi,
    /(?:ALL\s+SALES\s+(?:ARE\s+)?FINAL)[^\n]*/gi,
  ];
  
  for (const pattern of policyBlockPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      policyTextBlock += ' ' + matches.join(' ');
    }
  }
  
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
    // "returns/exchanges" with percentage
    /(\d+)%\s*(?:on\s+(?:all\s+)?)?(?:returns?|exchanges?)/i,
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

  // Exchange policy patterns - enhanced for "NO EXCHANGES" format
  const exchangePatterns = [
    /(\d+)\s*(?:day|days)\s*(?:exchange|swap)\s*(?:policy|period)?/i,
    /exchange(?:s)?\s*(?:within|accepted|only)?\s*(?:within)?\s*(\d+)\s*days?/i,
    /exchange\s+only/i,
    // "NO EXCHANGES" - common on receipts
    /no\s+exchange[s]?/i,
    // "NO EXCHANGES WITHOUT ORIGINAL INVOICE"
    /no\s+exchange[s]?\s*(?:,|\.|\s)?\s*(?:without|unless)/i,
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

  // Refund type patterns - enhanced for receipt formats
  const refundPatterns = [
    { pattern: /(?:full\s+refund|money\s+back\s+guarantee|100%\s+refund)/i, type: 'full' as const },
    { pattern: /(?:store\s+credit|credit\s+only|in-?store\s+credit)/i, type: 'store_credit' as const },
    { pattern: /(?:exchange\s+only|swap\s+only)/i, type: 'exchange_only' as const },
    { pattern: /(?:partial\s+refund|restocking\s+fee|handling\s+charge)/i, type: 'partial' as const },
    // "NO REFUNDS" patterns
    { pattern: /no\s+refund[s]?(?:\s+without|\s+unless|\s*,)?/i, type: 'none' as const },
    { pattern: /(?:final\s+sale|all\s+sales?\s+(?:are\s+)?final)/i, type: 'none' as const },
    { pattern: /goods\s+once\s+sold/i, type: 'none' as const },
    { pattern: /no\s+(?:cash\s+)?refund/i, type: 'none' as const },
    // "NOT RETURNABLE"
    { pattern: /not\s+returnable/i, type: 'none' as const },
  ];
  
  for (const { pattern, type } of refundPatterns) {
    if (pattern.test(text)) {
      result.policies.refundType = type;
      result.policies.policySource = 'extracted';
      break;
    }
  }
  
  // Special handling: If "HANDLING CHARGE" is mentioned, note it in return terms
  const handlingMatch = text.match(/(?:MINIMUM\s+)?HANDLING\s+CHARGE\s+(?:OF\s+)?(\d+)%/i);
  if (handlingMatch) {
    const handlingPercent = handlingMatch[1];
    const handlingNote = `${handlingPercent}% handling charge on returns/exchanges`;
    if (result.policies.returnPolicyTerms) {
      result.policies.returnPolicyTerms += '. ' + handlingNote;
    } else {
      result.policies.returnPolicyTerms = handlingNote;
    }
    result.policies.refundType = 'partial'; // Handling charge means partial refund
    result.policies.policySource = 'extracted';
  }
  
  // Special handling: "WITHOUT ORIGINAL INVOICE" requirement
  if (/without\s+original\s+invoice/i.test(text)) {
    const invoiceNote = 'Original invoice required';
    if (result.policies.returnPolicyTerms) {
      result.policies.returnPolicyTerms += '. ' + invoiceNote;
    } else {
      result.policies.returnPolicyTerms = invoiceNote;
    }
    result.policies.policySource = 'extracted';
  }
  
  // Special handling: Products "NOT RETURNABLE" (like cement, sand, etc.)
  const notReturnableMatch = text.match(/([A-Z,\s&]+)\s+(?:PRODUCTS?\s+)?NOT\s+RETURNABLE/i);
  if (notReturnableMatch) {
    const products = notReturnableMatch[1].trim();
    const nonReturnNote = `Non-returnable: ${products}`;
    if (result.policies.returnPolicyTerms) {
      result.policies.returnPolicyTerms += '. ' + nonReturnNote;
    } else {
      result.policies.returnPolicyTerms = nonReturnNote;
    }
    result.policies.policySource = 'extracted';
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
 * Uses Gemini Vision AI as primary OCR for best accuracy
 * Falls back to Tesseract if Gemini is unavailable
 * @param imagePath - Path to uploaded image
 * @returns Parsed receipt data
 */
export async function processReceipt(imagePath: string): Promise<ParsedReceipt> {
  // Check if Gemini is available before attempting to use it
  const geminiAvailable = await isGeminiAvailable();
  
  if (geminiAvailable) {
    try {
      console.log('[OCR] Attempting Gemini Vision AI for receipt scanning...');
      const geminiResult = await performGeminiOCR(imagePath);
      
      // Check if Gemini returned useful data
      if (geminiResult.merchant || geminiResult.total || geminiResult.date) {
        console.log('[OCR] Gemini Vision AI successful!');
        console.log(`[OCR] Gemini extracted: merchant="${geminiResult.merchant}", total=${geminiResult.total}, date="${geminiResult.date}", invoice="${geminiResult.invoiceNumber}"`);
        
        // Convert Gemini result to ParsedReceipt format
        const result: ParsedReceipt = {
          merchant: geminiResult.merchant,
          date: geminiResult.date,
          total: geminiResult.total,
          subtotal: geminiResult.subtotal,
          taxAmount: null,
          vatAmount: geminiResult.vatAmount,
          vatSource: geminiResult.vatSource,
          invoiceNumber: geminiResult.invoiceNumber,
          confidence: geminiResult.confidence,
          rawText: geminiResult.rawText,
          ocrConfidence: geminiResult.ocrConfidence,
          policies: geminiResult.policies,
          warnings: geminiResult.warnings
        };
        
        // Add TODO flags for any missing fields
        if (!result.merchant) {
          result.merchantTODO = 'Manual entry required';
        }
        if (!result.date) {
          result.dateTODO = 'Manual entry required';
        }
        if (!result.total) {
          result.totalTODO = 'Manual entry required';
        }
        
        return result;
      }
      
      console.log('[OCR] Gemini returned no useful data, falling back to Tesseract...');
    } catch (geminiError: any) {
      console.log('[OCR] Gemini Vision AI failed:', geminiError.message);
      console.log('[OCR] Falling back to Tesseract OCR...');
    }
  } else {
    console.log('[OCR] Gemini Vision AI not available, using Tesseract OCR...');
  }
  
  // Fallback to Tesseract OCR
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
