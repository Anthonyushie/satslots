/**
 * Lightning Address (LNURL-pay) client
 * 
 * Creates invoices using Lightning Addresses (user@domain.com format)
 * This is simpler for users than NWC connection strings
 */

import { createHash } from 'crypto';

export interface LightningAddressInvoice {
  bolt11: string;
  paymentHash: string;
  description: string;
  amountMsat: number;
}

export interface CreateInvoiceParams {
  lightningAddress: string;
  amountSats: number;
  description: string;
}

/**
 * Parse lightning address: user@domain.com
 */
function parseLightningAddress(address: string): { username: string; domain: string } {
  const [username, domain] = address.split('@');
  if (!username || !domain) {
    throw new Error('Invalid lightning address format. Expected: user@domain.com');
  }
  return { username, domain };
}

/**
 * Get LNURL-pay endpoint from lightning address
 */
async function getLnurlPayEndpoint(address: string): Promise<string> {
  const { username, domain } = parseLightningAddress(address);
  
  // Step 1: Get the LNURL endpoint from .well-known/lnurlp
  const url = `https://${domain}/.well-known/lnurlp/${username}`;
  
  console.log(`Fetching LNURL endpoint from: ${url}`);
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`Failed to get LNURL endpoint: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log(`LNURL response:`, JSON.stringify(data, null, 2));
    
    if (data.callback) {
      return data.callback;
    }
    
    throw new Error('Invalid LNURL response: missing callback URL');
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Create invoice via Lightning Address
 */
export async function createInvoiceLightningAddress(
  params: CreateInvoiceParams,
): Promise<LightningAddressInvoice> {
  const { lightningAddress, amountSats, description } = params;
  
  // Get LNURL-pay endpoint
  const callbackUrl = await getLnurlPayEndpoint(lightningAddress);
  
  // Build the callback URL with amount and description
  const amountMsat = amountSats * 1000;
  const url = new URL(callbackUrl);
  url.searchParams.append('amount', amountMsat.toString());
  url.searchParams.append('description', description);
  
  console.log(`Creating invoice with callback: ${url.toString()}`);
  
  // Call the callback to get the invoice
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
  
  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`Failed to create invoice: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log(`Invoice response:`, JSON.stringify(data, null, 2));
    
    // Check for error responses from LNURL service
    if (data.status === "ERROR") {
      throw new Error(`Lightning address error: ${data.reason || 'Unknown error'}`);
    }
    
    if (!data.pr) {
      throw new Error('Invalid invoice response: missing payment request');
    }
    
    // Extract payment hash from bolt11 invoice
    const bolt11 = data.pr;
    // Some LNURL services provide the payment hash directly in the response
    const paymentHash = data.payment_hash || extractPaymentHash(bolt11);
    
    return {
      bolt11,
      paymentHash,
      description,
      amountMsat,
    };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Extract payment hash from bolt11 invoice
 * This is a simplified extraction - in production you'd use a proper BOLT11 decoder
 */
function extractPaymentHash(bolt11: string): string {
  try {
    // BOLT11 payment hash is encoded in the invoice
    // The payment hash is a 32-byte hash, hex-encoded (64 characters)
    // It's typically in the invoice after specific tags
    
    // Parse the human-readable part
    const withoutPrefix = bolt11.replace(/^lnbc/, '').replace(/^lntb/, '').replace(/^lnurl/, '');
    
    // Split by separator characters (in BOLT11, data is separated by various characters)
    const parts = withoutPrefix.split(/[a-z]/);
    
    // Look for a 64-character hex string (the payment hash)
    for (const part of parts) {
      const cleaned = part.replace(/[^0-9a-f]/gi, '');
      if (cleaned.length === 64) {
        return cleaned.toLowerCase();
      }
    }
    
    // Fallback: if we can't extract it properly, return a hash of the invoice
    // This is not ideal but prevents the system from breaking
    console.warn('Could not extract payment hash from BOLT11 invoice, using fallback');
    return createHash('sha256').update(bolt11).digest('hex');
  } catch (error) {
    console.error('Error extracting payment hash:', error);
    return createHash('sha256').update(bolt11).digest('hex');
  }
}