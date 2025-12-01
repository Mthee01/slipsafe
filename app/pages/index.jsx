/**
 * SlipSafe Main Page
 * Upload receipt → parse → generate claim
 */

import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [serverUrl, setServerUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [claimResult, setClaimResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load server URL from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('slipsafe_server_url');
    if (saved) {
      setServerUrl(saved);
    }
  }, []);

  // Save server URL to localStorage
  const handleServerUrlChange = (e) => {
    const url = e.target.value;
    setServerUrl(url);
    localStorage.setItem('slipsafe_server_url', url);
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setUploadResult(null);
    setClaimResult(null);
    setError(null);
  };

  // Upload and parse receipt
  const handleParseReceipt = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    if (!serverUrl) {
      setError('Please set server URL first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch(`${serverUrl}/api/receipts/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      setUploadResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Create claim
  const handleCreateClaim = async () => {
    if (!uploadResult || !uploadResult.hash) {
      setError('No valid receipt data to create claim');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${serverUrl}/api/claims/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ hash: uploadResult.hash })
      });

      if (!response.ok) {
        throw new Error(`Claim creation failed: ${response.statusText}`);
      }

      const data = await response.json();
      setClaimResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>SlipSafe - Your receipts, returns, and warranties—secured</title>
        <meta name="description" content="Upload receipts, track warranties, and generate verifiable claims" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={styles.main}>
        <div style={styles.container}>
          {/* Header */}
          <div style={styles.header}>
            <h1 style={styles.title}>🔒 SlipSafe</h1>
            <p style={styles.subtitle}>Your receipts, returns, and warranties—secured</p>
          </div>

          {/* Server URL Configuration */}
          <div style={styles.section}>
            <label style={styles.label}>Server URL:</label>
            <input
              type="text"
              value={serverUrl}
              onChange={handleServerUrlChange}
              placeholder="http://localhost:3001"
              style={styles.input}
            />
            <p style={styles.hint}>
              This will be saved to localStorage
            </p>
          </div>

          {/* File Upload */}
          <div style={styles.section}>
            <label style={styles.label}>Upload Receipt:</label>
            <input
              type="file"
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/jpg,application/pdf"
              style={styles.fileInput}
            />
            {selectedFile && (
              <p style={styles.hint}>
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
            <button
              onClick={handleParseReceipt}
              disabled={loading || !selectedFile}
              style={{
                ...styles.button,
                ...(loading || !selectedFile ? styles.buttonDisabled : {})
              }}
            >
              {loading ? 'Processing...' : 'Parse Receipt'}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div style={styles.error}>
              ⚠️ {error}
            </div>
          )}

          {/* Upload Result */}
          {uploadResult && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Parsed Data</h2>
              <div style={styles.jsonBox}>
                <pre>{JSON.stringify(uploadResult, null, 2)}</pre>
              </div>

              {uploadResult.hash && (
                <button
                  onClick={handleCreateClaim}
                  disabled={loading}
                  style={{
                    ...styles.button,
                    ...styles.buttonPrimary,
                    ...(loading ? styles.buttonDisabled : {})
                  }}
                >
                  Create Claim
                </button>
              )}
            </div>
          )}

          {/* Claim Result */}
          {claimResult && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>✅ Claim Created</h2>
              
              <div style={styles.claimCard}>
                {/* QR Code Display */}
                {claimResult.qrCodeDataUrl && (
                  <div style={styles.qrCodeContainer}>
                    <img 
                      src={claimResult.qrCodeDataUrl} 
                      alt="Claim QR Code"
                      style={styles.qrCode}
                    />
                    <p style={styles.qrHint}>Scan to verify claim</p>
                  </div>
                )}

                <div style={styles.claimRow}>
                  <span style={styles.claimLabel}>6-Digit PIN:</span>
                  <span style={styles.pin}>{claimResult.pin}</span>
                </div>

                <div style={styles.claimRow}>
                  <span style={styles.claimLabel}>Verifier URL:</span>
                  <a
                    href={claimResult.qrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.link}
                  >
                    {claimResult.qrUrl}
                  </a>
                </div>

                <div style={styles.claimRow}>
                  <span style={styles.claimLabel}>Token:</span>
                  <code style={styles.code}>{claimResult.token.substring(0, 50)}...</code>
                </div>

                <button
                  onClick={() => window.open(claimResult.qrUrl, '_blank')}
                  style={{ ...styles.button, ...styles.buttonPrimary, marginTop: '1rem' }}
                >
                  Open Verifier Page
                </button>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div style={styles.instructions}>
            <h3 style={styles.instructionTitle}>How to Use</h3>
            <ol style={styles.instructionList}>
              <li>Enter your server URL (e.g., http://localhost:3001)</li>
              <li>Upload a receipt image (JPEG, PNG, or PDF)</li>
              <li>Click "Parse Receipt" to extract data using OCR</li>
              <li>Review the parsed merchant, date, and total</li>
              <li>Click "Create Claim" to generate verifier URL and PIN</li>
              <li>Share the verifier link or PIN with merchant staff</li>
            </ol>
          </div>
        </div>
      </main>
    </>
  );
}

// Inline styles for MVP
const styles = {
  main: {
    minHeight: '100vh',
    background: '#f3f4f6',
    padding: '2rem 1rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    background: 'white',
    borderRadius: '12px',
    padding: '2rem',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
    paddingBottom: '1rem',
    borderBottom: '2px solid #e5e7eb'
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#1f2937',
    margin: '0 0 0.5rem 0'
  },
  subtitle: {
    fontSize: '1.125rem',
    color: '#6b7280',
    margin: 0
  },
  section: {
    marginBottom: '2rem'
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '1rem'
  },
  label: {
    display: 'block',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.5rem'
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '1rem',
    fontFamily: 'inherit'
  },
  fileInput: {
    width: '100%',
    padding: '0.75rem',
    border: '2px dashed #d1d5db',
    borderRadius: '6px',
    fontSize: '1rem',
    cursor: 'pointer',
    marginBottom: '0.5rem'
  },
  hint: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '0.5rem'
  },
  button: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    background: '#3b82f6',
    color: 'white',
    marginTop: '1rem',
    transition: 'background 0.2s'
  },
  buttonPrimary: {
    background: '#10b981'
  },
  buttonDisabled: {
    background: '#9ca3af',
    cursor: 'not-allowed'
  },
  error: {
    padding: '1rem',
    background: '#fee2e2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    color: '#dc2626',
    marginBottom: '1rem'
  },
  jsonBox: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '1rem',
    overflow: 'auto',
    maxHeight: '400px',
    marginBottom: '1rem'
  },
  claimCard: {
    background: '#f0fdf4',
    border: '2px solid #10b981',
    borderRadius: '8px',
    padding: '1.5rem'
  },
  qrCodeContainer: {
    textAlign: 'center',
    marginBottom: '1.5rem',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid #10b981'
  },
  qrCode: {
    width: '256px',
    height: '256px',
    margin: '0 auto',
    display: 'block',
    border: '4px solid white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
  },
  qrHint: {
    marginTop: '0.5rem',
    fontSize: '0.875rem',
    color: '#065f46',
    fontWeight: '600'
  },
  claimRow: {
    marginBottom: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  claimLabel: {
    fontWeight: '600',
    color: '#065f46'
  },
  pin: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#10b981',
    fontFamily: 'monospace',
    letterSpacing: '0.25rem'
  },
  code: {
    background: '#1f2937',
    color: '#10b981',
    padding: '0.5rem',
    borderRadius: '4px',
    fontSize: '0.875rem',
    wordBreak: 'break-all',
    display: 'block'
  },
  link: {
    color: '#3b82f6',
    textDecoration: 'none',
    wordBreak: 'break-all'
  },
  instructions: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    padding: '1.5rem',
    marginTop: '2rem'
  },
  instructionTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: '1rem'
  },
  instructionList: {
    paddingLeft: '1.5rem',
    color: '#1e3a8a',
    lineHeight: '1.8'
  }
};
