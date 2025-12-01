/**
 * Supabase REST API helpers
 * Provides CRUD operations for purchases table
 */

import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

/**
 * Insert a new purchase into Supabase
 * @param {Object} purchase - {hash, merchant, date, total, returnBy, warrantyEnds}
 * @returns {Promise<Object>} Inserted purchase with id
 */
export async function insertPurchase(purchase) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/purchases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(purchase)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase insert failed: ${error}`);
  }

  const data = await response.json();
  return data[0];
}

/**
 * Get purchase by hash
 * @param {string} hash - SHA256 hash of merchant|date|total
 * @returns {Promise<Object|null>} Purchase or null if not found
 */
export async function getPurchaseByHash(hash) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/purchases?hash=eq.${hash}&select=*`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase query failed: ${error}`);
  }

  const data = await response.json();
  return data.length > 0 ? data[0] : null;
}

/**
 * Get all purchases (for future use)
 * @returns {Promise<Array>} All purchases
 */
export async function getAllPurchases() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/purchases?select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase query failed: ${error}`);
  }

  return await response.json();
}
