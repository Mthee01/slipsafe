/**
 * Receipt upload and OCR processing routes
 */

import { Router } from 'express';
import multer from 'multer';
import { processReceipt } from '../lib/ocr.js';
import { computeDeadlines } from '../lib/rules.js';
import { generateHash } from '../lib/tokens.js';
import { insertPurchase } from '../lib/db.js';
import { normalizeDate } from '../lib/utils.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
    }
  }
});

/**
 * POST /api/receipts/upload
 * Upload receipt image, perform OCR, parse data, compute deadlines, and persist to DB
 */
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log('Processing receipt:', req.file.path);

    // Step 1: Perform OCR and parse
    const parsed = await processReceipt(req.file.path);
    
    // Step 2: Normalize date
    const normalizedDate = parsed.date ? normalizeDate(parsed.date) : null;
    
    // Step 3: Compute deadlines if we have a date
    let deadlines = { returnBy: null, warrantyEnds: null };
    if (normalizedDate) {
      deadlines = computeDeadlines(normalizedDate);
    } else {
      // Add TODO flag for missing date
      deadlines.deadlinesTODO = 'Cannot compute deadlines without purchase date';
    }

    // Step 4: Generate hash (only if we have all required fields)
    let hash = null;
    let id = null;
    
    if (parsed.merchant && normalizedDate && parsed.total !== null) {
      hash = generateHash(parsed.merchant, normalizedDate, parsed.total);
      
      // Step 5: Persist to Supabase
      try {
        const purchase = await insertPurchase({
          hash,
          merchant: parsed.merchant,
          date: normalizedDate,
          total: parsed.total,
          returnBy: deadlines.returnBy,
          warrantyEnds: deadlines.warrantyEnds
        });
        id = purchase.id;
        console.log('Purchase saved:', id);
      } catch (dbError) {
        console.error('Database insert failed:', dbError.message);
        // Continue even if DB insert fails - return parsed data with warning
        parsed.dbWarning = 'Data parsed but not saved to database';
      }
    } else {
      parsed.hashTODO = 'Cannot generate hash - missing required fields (merchant, date, or total)';
    }

    // Step 6: Return response
    res.json({
      parsed: {
        merchant: parsed.merchant,
        date: normalizedDate,
        total: parsed.total,
        confidence: parsed.confidence,
        rawText: parsed.rawText,
        ...(parsed.merchantTODO && { merchantTODO: parsed.merchantTODO }),
        ...(parsed.dateTODO && { dateTODO: parsed.dateTODO }),
        ...(parsed.totalTODO && { totalTODO: parsed.totalTODO }),
        ...(parsed.hashTODO && { hashTODO: parsed.hashTODO }),
        ...(parsed.dbWarning && { dbWarning: parsed.dbWarning })
      },
      deadlines: {
        returnBy: deadlines.returnBy,
        warrantyEnds: deadlines.warrantyEnds,
        ...(deadlines.deadlinesTODO && { deadlinesTODO: deadlines.deadlinesTODO })
      },
      hash,
      id
    });

  } catch (error) {
    console.error('Receipt processing error:', error);
    res.status(500).json({
      error: 'Receipt processing failed',
      message: error.message
    });
  }
});

export default router;
