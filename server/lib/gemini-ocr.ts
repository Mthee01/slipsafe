import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  
  if (!apiKey) {
    throw new Error('No Gemini API key available');
  }
  
  // Use Replit AI Integrations with empty apiVersion (required for Replit integration)
  if (baseUrl) {
    return new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        baseUrl,
        apiVersion: ""  // Critical: must be empty string for Replit integration
      }
    });
  }
  
  // Fallback for direct Gemini API key usage
  return new GoogleGenAI({ apiKey });
}

type RefundType = 'not_specified' | 'none' | 'full' | 'store_credit' | 'exchange_only' | 'partial' | null;

function normalizeRefundType(value: string | null): RefundType {
  if (!value) return 'not_specified';
  const lower = value.toLowerCase().trim();
  if (lower.includes('full') || lower.includes('cash')) return 'full';
  if (lower.includes('credit') || lower.includes('store')) return 'store_credit';
  if (lower.includes('exchange')) return 'exchange_only';
  if (lower.includes('partial')) return 'partial';
  if (lower.includes('none') || lower.includes('no refund')) return 'none';
  return null;
}

/**
 * Analyze policy terms text to intelligently detect return restrictions
 * and set appropriate refundType and returnPolicyDays
 * 
 * IMPORTANT: Distinguishes between:
 * - UNCONDITIONAL bans: "ALL SALES FINAL", "NO RETURNS PERIOD" → refundType: 'none'
 * - CONDITIONAL policies: "NO REFUNDS WITHOUT INVOICE/RECEIPT" → returns allowed with conditions
 */
function analyzePolicyTerms(policies: GeminiReceiptData['policies']): GeminiReceiptData['policies'] {
  const terms = policies.returnPolicyTerms?.toUpperCase() || '';
  
  // First, check for CONDITIONAL policies (returns allowed with conditions)
  // These should NOT be treated as "no returns" - they mean returns ARE allowed with receipt/invoice
  const conditionalPatterns = [
    /WITHOUT\s+(ORIGINAL\s+)?(RECEIPT|INVOICE|SLIP|PROOF)/i,
    /MUST\s+HAVE\s+(ORIGINAL\s+)?(RECEIPT|INVOICE|SLIP)/i,
    /REQUIRE[SD]?\s+(ORIGINAL\s+)?(RECEIPT|INVOICE|SLIP)/i,
    /WITH\s+(ORIGINAL\s+)?(RECEIPT|INVOICE|SLIP)\s+ONLY/i,
    /ORIGINAL\s+(RECEIPT|INVOICE|SLIP)\s+REQUIRED/i,
  ];
  
  const hasConditionalPolicy = conditionalPatterns.some(pattern => pattern.test(terms));
  
  // Detect UNCONDITIONAL "no returns" patterns (truly no returns allowed)
  const unconditionalNoReturnsPatterns = [
    /ALL\s+SALES\s+FINAL/i,
    /FINAL\s+SALE/i,
    /NO\s+RETURNS?\s+UNDER\s+ANY/i,
    /ABSOLUTELY\s+NO\s+RETURN/i,
    /NON[\s-]?REFUNDABLE\s+ITEM/i,
  ];
  
  const hasUnconditionalNoReturns = unconditionalNoReturnsPatterns.some(pattern => pattern.test(terms));
  
  // Detect exchange-only patterns
  const exchangeOnlyPatterns = [
    /EXCHANGE\s+ONLY/i,
    /EXCHANGE\s+WITHIN/i,
    /NO\s+CASH\s+REFUND/i,
    /CREDIT\s+NOTE\s+ONLY/i,
  ];
  
  const isExchangeOnly = exchangeOnlyPatterns.some(pattern => pattern.test(terms));
  
  // Detect store credit patterns
  const storeCreditPatterns = [
    /STORE\s+CREDIT/i,
    /CREDIT\s+ONLY/i,
    /VOUCHER\s+ONLY/i,
  ];
  
  const isStoreCredit = storeCreditPatterns.some(pattern => pattern.test(terms));
  
  // Detect handling fees (implies partial refund)
  const hasHandlingFee = /HANDLING\s+(CHARGE|FEE)|RESTOCKING\s+FEE/i.test(terms);
  
  // Extract return days if present
  const daysMatch = terms.match(/(\d+)\s*DAYS?/i);
  const extractedDays = daysMatch ? parseInt(daysMatch[1]) : null;
  
  // Apply detected policy rules with priority:
  // 1. Conditional policies (returns allowed with conditions) - NOT "no returns"
  // 2. Unconditional no-returns - truly no returns allowed
  // 3. Exchange-only or store credit policies
  // 4. Standard return policies with days
  
  if (hasConditionalPolicy && !policies.refundType) {
    // Conditional policy means returns ARE allowed (with receipt/invoice)
    // Don't set refundType to 'none' - leave as extracted or set based on other indicators
    if (isExchangeOnly) {
      policies.refundType = 'exchange_only';
    } else if (isStoreCredit) {
      policies.refundType = 'store_credit';
    } else if (hasHandlingFee) {
      policies.refundType = 'partial';
    }
    // Note: Don't set returnPolicyDays here - it should come from merchant rules if not on receipt
    if (extractedDays && policies.returnPolicyDays === null) {
      policies.returnPolicyDays = extractedDays;
    }
  } else if (hasUnconditionalNoReturns && !policies.refundType) {
    // Truly no returns allowed
    policies.refundType = 'none';
    if (policies.returnPolicyDays === null) {
      policies.returnPolicyDays = 0;
    }
  } else if (isExchangeOnly && !policies.refundType) {
    policies.refundType = 'exchange_only';
    if (extractedDays && policies.returnPolicyDays === null) {
      policies.returnPolicyDays = extractedDays;
    }
  } else if (isStoreCredit && !policies.refundType) {
    policies.refundType = 'store_credit';
    if (extractedDays && policies.returnPolicyDays === null) {
      policies.returnPolicyDays = extractedDays;
    }
  } else if (extractedDays && policies.returnPolicyDays === null) {
    policies.returnPolicyDays = extractedDays;
    // If days are specified but refund type is unknown, assume full refund
    if (!policies.refundType) {
      policies.refundType = hasHandlingFee ? 'partial' : 'full';
    }
  }
  
  // Mark policy source as extracted if we found policy terms
  if (policies.returnPolicyTerms) {
    policies.policySource = 'extracted';
  }
  
  return policies;
}

interface GeminiReceiptData {
  merchant: string | null;
  date: string | null;
  total: number | null;
  subtotal: number | null;
  vatAmount: number | null;
  vatSource: 'extracted' | 'calculated' | 'none';
  invoiceNumber: string | null;
  rawText: string;
  policies: {
    returnPolicyDays: number | null;
    returnPolicyTerms: string | null;
    refundType: RefundType;
    exchangePolicyDays: number | null;
    exchangePolicyTerms: string | null;
    warrantyMonths: number | null;
    warrantyTerms: string | null;
    policySource: 'extracted' | 'merchant_default' | 'user_entered';
  };
  confidence: 'high' | 'medium' | 'low';
  ocrConfidence: number;
  warnings: string[];
}

const RECEIPT_EXTRACTION_PROMPT = `You are an expert receipt scanner specialized in SOUTH AFRICAN receipts. 

CRITICAL RULES:
1. CURRENCY: This is a South African receipt. Currency is ZAR (Rands). ALL amounts in your output MUST be plain numbers only - NEVER include R, $, or any currency symbol. The currency is implicitly ZAR.
2. MERCHANT NAME: Look for the business name at the TOP of the receipt, usually before "TAX INVOICE" or item lines. It's often the largest/boldest text. Ignore Wi-Fi passwords, MAC addresses, till IDs, operator names, and street addresses.
3. TOTAL AMOUNT: Find the BOTTOM-MOST line labeled "TOTAL", "AMOUNT DUE", "TOTAL PAYABLE", or "AMOUNT PAYABLE" near the receipt footer. NEVER use line-item prices or partial sums as the total, even if they appear larger numerically.
4. VAT VALIDATION: South African VAT is 15%. If both subtotal and VAT are shown, verify: total = subtotal + VAT (±1% for rounding). If multiple totals exist, choose the one that satisfies this equation.

TOTAL DISAMBIGUATION (CRITICAL):
- Always pick the BOTTOM-MOST labeled TOTAL/AMOUNT DUE/AMOUNT PAYABLE closest to the footer
- If multiple candidates exist, prefer the value consistent with subtotal + 15% VAT
- NEVER use line-item sums or individual product prices as the total
- The final total is what the customer actually paid

POLICY EXTRACTION (IMPORTANT):
Look for return/refund/exchange policies, usually at the bottom of the receipt. Extract BOTH the specific days/period AND the full policy text.

CRITICAL DISTINCTION - CONDITIONAL vs UNCONDITIONAL POLICIES:
- CONDITIONAL policies like "NO REFUNDS WITHOUT ORIGINAL INVOICE" mean returns ARE ALLOWED with the invoice
  → Do NOT set refundType: "none" - this is a conditional allowance, not a ban
  → Leave returnPolicyDays: null if no specific days mentioned (will use merchant default)
- UNCONDITIONAL bans like "ALL SALES FINAL" or "FINAL SALE" mean truly no returns
  → Set refundType: "none", returnPolicyDays: 0

POLICY KEYWORDS TO DETECT:
- "ALL SALES FINAL" / "FINAL SALE" / "ABSOLUTELY NO RETURNS" → refundType: "none", returnPolicyDays: 0
- "NO REFUNDS/RETURNS WITHOUT RECEIPT/INVOICE" → Returns allowed with conditions (NOT refundType: "none")
- "EXCHANGE ONLY" / "EXCHANGE WITHIN X DAYS" → refundType: "exchange_only"
- "STORE CREDIT ONLY" → refundType: "store_credit"
- "X DAY RETURN" / "RETURN WITHIN X DAYS" → returnPolicyDays: X
- "HANDLING CHARGE" / "RESTOCKING FEE" → refundType: "partial"

OUTPUT FORMAT - ALL AMOUNTS ARE PLAIN NUMBERS (no currency symbols):

{
  "merchant": "Store/business name from receipt header",
  "date": "Purchase date in YYYY-MM-DD format",
  "total": 219.00,
  "subtotal": 190.43,
  "vatAmount": 28.57,
  "invoiceNumber": "Invoice/Receipt number with prefix (e.g., INS7937966)",
  "rawText": "Full text content of the receipt",
  "policies": {
    "returnPolicyDays": null,
    "returnPolicyTerms": null,
    "refundType": null,
    "exchangePolicyDays": null,
    "exchangePolicyTerms": null,
    "warrantyMonths": null,
    "warrantyTerms": null
  }
}

CRITICAL POLICY RULES:
- ONLY set policy values if EXPLICITLY stated on the receipt
- If no return/refund policy is mentioned on receipt → set returnPolicyDays: null, refundType: null
- If no warranty is mentioned on receipt → set warrantyMonths: null
- NEVER assume or invent policy values - only extract what's written
- DO NOT use default values like 30 days or 12 months unless receipt explicitly states them
- CONDITIONAL policies ("without invoice") are NOT the same as "no returns" - see examples below

POLICY EXAMPLES:

Example 1 - CONDITIONAL policy (returns allowed with invoice):
Receipt text: "NO COLLECTIONS, NO EXCHANGES, NO REFUNDS WITHOUT ORIGINAL INVOICE"
Output policies: {"returnPolicyDays": null, "refundType": null, "returnPolicyTerms": "NO COLLECTIONS, NO EXCHANGES, NO REFUNDS WITHOUT ORIGINAL INVOICE"}
EXPLANATION: "WITHOUT ORIGINAL INVOICE" means returns ARE allowed WITH the invoice. Do NOT set refundType to "none".

Example 2 - Handling fee (partial refund):
Receipt text: "MINIMUM HANDLING CHARGE OF 15% ON ALL RETURNS/EXCHANGES"
Output policies: {"returnPolicyDays": null, "refundType": "partial", "returnPolicyTerms": "MINIMUM HANDLING CHARGE OF 15% ON ALL RETURNS/EXCHANGES"}

Example 3 - Standard return with days:
Receipt text: "RETURNS ACCEPTED WITHIN 30 DAYS WITH RECEIPT"
Output policies: {"returnPolicyDays": 30, "refundType": "full", "returnPolicyTerms": "RETURNS ACCEPTED WITHIN 30 DAYS WITH RECEIPT"}

Example 4 - UNCONDITIONAL no returns (truly no returns):
Receipt text: "ALL SALES FINAL - NO RETURNS OR EXCHANGES"
Output policies: {"returnPolicyDays": 0, "refundType": "none", "returnPolicyTerms": "ALL SALES FINAL - NO RETURNS OR EXCHANGES"}

Example 5 - Item-specific restrictions (note in terms, don't assume no returns for all):
Receipt text: "SAND, STONE, CEMENT NOT RETURNABLE. OTHER ITEMS 14 DAY RETURN."
Output policies: {"returnPolicyDays": 14, "refundType": "full", "returnPolicyTerms": "SAND, STONE, CEMENT NOT RETURNABLE. OTHER ITEMS 14 DAY RETURN."}

VALIDATION CHECKLIST:
- Merchant: Business name from header, not addresses or item descriptions
- Total: Bottom-most TOTAL label, verified against subtotal+VAT if available
- Amounts: Plain numbers only, never include R or $ symbols
- Invoice: Include prefixes like INV, IN, INS, TX
- Policies: Extract full policy text AND set appropriate returnPolicyDays (0 for no returns) and refundType

Return ONLY valid JSON, no additional text.`;

export async function performGeminiOCR(imagePath: string): Promise<GeminiReceiptData> {
  const result: GeminiReceiptData = {
    merchant: null,
    date: null,
    total: null,
    subtotal: null,
    vatAmount: null,
    vatSource: 'none',
    invoiceNumber: null,
    rawText: '',
    policies: {
      returnPolicyDays: null,
      returnPolicyTerms: null,
      refundType: 'not_specified',
      exchangePolicyDays: null,
      exchangePolicyTerms: null,
      warrantyMonths: null,
      warrantyTerms: null,
      policySource: 'extracted',
    },
    confidence: 'low',
    ocrConfidence: 0,
    warnings: []
  };

  try {
    const ai = getGeminiClient();
    
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';

    console.log(`[Gemini OCR] Analyzing image: ${imagePath}`);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image
              }
            },
            {
              text: RECEIPT_EXTRACTION_PROMPT
            }
          ]
        }
      ]
    });

    const responseText = response.text || '';
    console.log(`[Gemini OCR] Response received, length: ${responseText.length}`);
    
    let jsonStr = responseText.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    
    // Validate JSON structure before parsing
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError: any) {
      console.error('[Gemini OCR] JSON parse error:', parseError.message);
      console.log('[Gemini OCR] Raw response:', responseText.substring(0, 500));
      result.warnings.push('Failed to parse Gemini response as JSON');
      throw new Error('Invalid JSON response from Gemini');
    }
    
    // Validate that parsed is an object
    if (!parsed || typeof parsed !== 'object') {
      console.error('[Gemini OCR] Invalid response structure - not an object');
      throw new Error('Gemini response is not a valid object');
    }
    
    console.log(`[Gemini OCR] Parsed response:`, JSON.stringify(parsed, null, 2));
    
    if (parsed.merchant) result.merchant = parsed.merchant;
    if (parsed.date) result.date = parsed.date;
    if (parsed.total) result.total = typeof parsed.total === 'number' ? parsed.total : parseFloat(parsed.total);
    if (parsed.subtotal) result.subtotal = typeof parsed.subtotal === 'number' ? parsed.subtotal : parseFloat(parsed.subtotal);
    if (parsed.vatAmount) {
      result.vatAmount = typeof parsed.vatAmount === 'number' ? parsed.vatAmount : parseFloat(parsed.vatAmount);
      result.vatSource = 'extracted';
    }
    if (parsed.invoiceNumber) result.invoiceNumber = parsed.invoiceNumber;
    if (parsed.rawText) result.rawText = parsed.rawText;
    
    if (parsed.policies) {
      if (parsed.policies.returnPolicyDays !== undefined && parsed.policies.returnPolicyDays !== null) {
        result.policies.returnPolicyDays = parseInt(parsed.policies.returnPolicyDays);
      }
      if (parsed.policies.returnPolicyTerms) result.policies.returnPolicyTerms = parsed.policies.returnPolicyTerms;
      if (parsed.policies.refundType) result.policies.refundType = normalizeRefundType(parsed.policies.refundType);
      if (parsed.policies.exchangePolicyDays) result.policies.exchangePolicyDays = parseInt(parsed.policies.exchangePolicyDays);
      if (parsed.policies.exchangePolicyTerms) result.policies.exchangePolicyTerms = parsed.policies.exchangePolicyTerms;
      if (parsed.policies.warrantyMonths) result.policies.warrantyMonths = parseInt(parsed.policies.warrantyMonths);
      if (parsed.policies.warrantyTerms) result.policies.warrantyTerms = parsed.policies.warrantyTerms;
    }
    
    // Apply intelligent policy analysis to detect "no returns" and other conditions from text
    result.policies = analyzePolicyTerms(result.policies);
    console.log(`[Gemini OCR] Policy analysis: returnPolicyDays=${result.policies.returnPolicyDays}, refundType=${result.policies.refundType}`);
    
    let fieldsExtracted = 0;
    if (result.merchant) fieldsExtracted++;
    if (result.date) fieldsExtracted++;
    if (result.total) fieldsExtracted++;
    if (result.invoiceNumber) fieldsExtracted++;
    
    if (fieldsExtracted >= 4) {
      result.confidence = 'high';
      result.ocrConfidence = 95;
    } else if (fieldsExtracted >= 2) {
      result.confidence = 'medium';
      result.ocrConfidence = 70;
    } else {
      result.confidence = 'low';
      result.ocrConfidence = 40;
    }
    
    console.log(`[Gemini OCR] Extraction complete. Confidence: ${result.confidence}, Fields: ${fieldsExtracted}`);
    
  } catch (error: any) {
    console.error('[Gemini OCR] Error:', error);
    result.warnings.push(`Gemini OCR failed: ${error.message}`);
    
    if (error.message?.includes('API key') || error.message?.includes('authentication')) {
      result.warnings.push('Gemini API not configured. Falling back to Tesseract OCR.');
    }
  }

  return result;
}

export async function isGeminiAvailable(): Promise<boolean> {
  try {
    const ai = getGeminiClient();
    return true;
  } catch {
    return false;
  }
}

const EMAIL_RECEIPT_PROMPT = `You are an expert at parsing email receipts and order confirmations, specialized in SOUTH AFRICAN stores and e-commerce.

CRITICAL RULES:
1. CURRENCY: Assume South African Rand (ZAR). Output amounts as numbers only (no currency symbols). Never use $ or USD.
2. MERCHANT: Extract the store/business name from the email sender or header.
3. TOTAL: Find the FINAL total amount the customer was charged.
4. VAT: South African VAT is 15%. If subtotal and VAT are shown, total ≈ subtotal + VAT.

Extract the following in JSON format:

{
  "merchant": "Store/business name from email",
  "date": "Purchase/Order date in YYYY-MM-DD format",
  "total": "Total amount charged as a number",
  "subtotal": "Subtotal before VAT, or null if not shown",
  "vatAmount": "VAT amount, or null if not shown",
  "invoiceNumber": "Order number, invoice number, or confirmation number",
  "policies": {
    "returnPolicyDays": "Days for returns, or null",
    "returnPolicyTerms": "Return policy text if mentioned",
    "refundType": "Type of refund (cash, store credit, exchange only), or null",
    "exchangePolicyDays": "Days for exchanges, or null",
    "exchangePolicyTerms": "Exchange policy text if mentioned",
    "warrantyMonths": "Warranty months, or null",
    "warrantyTerms": "Warranty text if mentioned"
  }
}

Important:
- Extract the EXACT merchant/store name
- Look for order numbers, confirmation numbers, invoice numbers  
- If VAT is not explicitly shown, set vatAmount to null
- Return ONLY valid JSON, no additional text`;

/**
 * Parse email receipt text using Gemini AI
 * Superior accuracy for complex email formats and order confirmations
 */
export async function parseEmailWithGemini(emailText: string): Promise<GeminiReceiptData> {
  const result: GeminiReceiptData = {
    merchant: null,
    date: null,
    total: null,
    subtotal: null,
    vatAmount: null,
    vatSource: 'none',
    invoiceNumber: null,
    rawText: emailText,
    policies: {
      returnPolicyDays: null,
      returnPolicyTerms: null,
      refundType: 'not_specified',
      exchangePolicyDays: null,
      exchangePolicyTerms: null,
      warrantyMonths: null,
      warrantyTerms: null,
      policySource: 'extracted',
    },
    confidence: 'low',
    ocrConfidence: 100,
    warnings: []
  };

  try {
    const ai = getGeminiClient();

    console.log(`[Gemini Text] Parsing email receipt, length: ${emailText.length}`);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${EMAIL_RECEIPT_PROMPT}\n\nEmail Content:\n${emailText}`
            }
          ]
        }
      ]
    });

    const responseText = response.text || '';
    console.log(`[Gemini Text] Response received, length: ${responseText.length}`);
    
    let jsonStr = responseText.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError: any) {
      console.error('[Gemini Text] JSON parse error:', parseError.message);
      result.warnings.push('Failed to parse Gemini response as JSON');
      throw new Error('Invalid JSON response from Gemini');
    }
    
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Gemini response is not a valid object');
    }
    
    console.log(`[Gemini Text] Parsed response:`, JSON.stringify(parsed, null, 2));
    
    if (parsed.merchant) result.merchant = parsed.merchant;
    if (parsed.date) result.date = parsed.date;
    if (parsed.total) result.total = typeof parsed.total === 'number' ? parsed.total : parseFloat(parsed.total);
    if (parsed.subtotal) result.subtotal = typeof parsed.subtotal === 'number' ? parsed.subtotal : parseFloat(parsed.subtotal);
    if (parsed.vatAmount) {
      result.vatAmount = typeof parsed.vatAmount === 'number' ? parsed.vatAmount : parseFloat(parsed.vatAmount);
      result.vatSource = 'extracted';
    }
    if (parsed.invoiceNumber) result.invoiceNumber = parsed.invoiceNumber;
    
    if (parsed.policies) {
      if (parsed.policies.returnPolicyDays) result.policies.returnPolicyDays = parseInt(parsed.policies.returnPolicyDays);
      if (parsed.policies.returnPolicyTerms) result.policies.returnPolicyTerms = parsed.policies.returnPolicyTerms;
      if (parsed.policies.refundType) result.policies.refundType = normalizeRefundType(parsed.policies.refundType);
      if (parsed.policies.exchangePolicyDays) result.policies.exchangePolicyDays = parseInt(parsed.policies.exchangePolicyDays);
      if (parsed.policies.exchangePolicyTerms) result.policies.exchangePolicyTerms = parsed.policies.exchangePolicyTerms;
      if (parsed.policies.warrantyMonths) result.policies.warrantyMonths = parseInt(parsed.policies.warrantyMonths);
      if (parsed.policies.warrantyTerms) result.policies.warrantyTerms = parsed.policies.warrantyTerms;
    }
    
    let fieldsExtracted = 0;
    if (result.merchant) fieldsExtracted++;
    if (result.date) fieldsExtracted++;
    if (result.total) fieldsExtracted++;
    if (result.invoiceNumber) fieldsExtracted++;
    
    if (fieldsExtracted >= 4) {
      result.confidence = 'high';
    } else if (fieldsExtracted >= 2) {
      result.confidence = 'medium';
    } else {
      result.confidence = 'low';
    }
    
    console.log(`[Gemini Text] Extraction complete. Confidence: ${result.confidence}, Fields: ${fieldsExtracted}`);
    
  } catch (error: any) {
    console.error('[Gemini Text] Error:', error);
    result.warnings.push(`Gemini text parsing failed: ${error.message}`);
  }

  return result;
}
