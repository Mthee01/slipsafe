/**
 * SlipSafe Server
 * Express API with OCR, claims, and USSD endpoints
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import receiptsRouter from './routes/receipts.js';
import claimsRouter from './routes/claims.js';
import ussdRouter from './routes/ussd.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists for Multer
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
  console.log('✅ Created uploads/ directory');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// API routes
app.use('/api/receipts', receiptsRouter);
app.use('/api/claims', claimsRouter);
app.use('/api/ussd', ussdRouter);

// Verifier page route (mounted at root for GET /claim/:token)
import claimsVerifierRouter from './routes/claims.js';
app.use('/claim', claimsVerifierRouter);

// Static file serving for uploaded receipts (optional)
app.use('/uploads', express.static('uploads'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SlipSafe server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`📤 Upload endpoint: http://localhost:${PORT}/api/receipts/upload`);
  console.log(`🔐 Claims endpoint: http://localhost:${PORT}/api/claims/create`);
  console.log(`📱 USSD endpoint: http://localhost:${PORT}/api/ussd`);
});
