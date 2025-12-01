/**
 * OCR and receipt parsing helpers
 * Uses Tesseract.js to extract text from receipt images
 */

import Tesseract from 'tesseract.js';

interface ParsedReceipt {
  merchant: string | null;
  date: string | null;
  total: number | null;
  confidence: 'low' | 'medium' | 'high';
  rawText: string;
  merchantTODO?: string;
  dateTODO?: string;
  totalTODO?: string;
}

/**
 * Extract text from receipt image using OCR
 * @param imagePath - Path to uploaded image
 * @returns Extracted text
 */
export async function performOCR(imagePath: string): Promise<string> {
  try {
    const result = await Tesseract.recognize(imagePath, 'eng', {
      logger: (info: any) => console.log('OCR Progress:', info)
    });
    
    return result.data.text;
  } catch (error) {
    console.error('OCR failed:', error);
    throw new Error('OCR processing failed');
  }
}

/**
 * Parse receipt text to extract merchant, date, and total
 * Uses regex and heuristics with fallback handling
 * @param text - OCR extracted text
 * @returns Parsed receipt data
 */
export function parseReceiptText(text: string): ParsedReceipt {
  const result: ParsedReceipt = {
    merchant: null,
    date: null,
    total: null,
    confidence: 'low',
    rawText: text
  };

  // Enhanced merchant detection
  // Priority order: explicit merchant indicators, first significant line, brand names
  const merchantPatterns = [
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
      // Filter out common non-merchant lines
      if (!merchant.match(/^(receipt|invoice|tax|date|time|total|subtotal|qty|item|price)/i)) {
        result.merchant = merchant;
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
    // Standard total with currency symbols and decimal
    /(?:total|grand\s*total|amount\s*due|balance)[\s:]*[$£€¥₹KES]*\s*(\d+[,\s]*\d*\.?\d{0,2})/i,
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
  const text = await performOCR(imagePath);
  const parsed = parseReceiptText(text);
  
  // Add TODO flags for missing fields
  if (!parsed.merchant) {
    parsed.merchantTODO = 'Manual entry required - OCR could not detect merchant';
  }
  if (!parsed.date) {
    parsed.dateTODO = 'Manual entry required - OCR could not detect date';
  }
  if (!parsed.total) {
    parsed.totalTODO = 'Manual entry required - OCR could not detect total';
  }

  return parsed;
}
