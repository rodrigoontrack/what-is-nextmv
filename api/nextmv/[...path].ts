import type { VercelRequest, VercelResponse } from '@vercel/node';

const NEXTMV_API_BASE = 'https://api.cloud.nextmv.io';
const NEXTMV_API_KEY = process.env.VITE_NEXTMV_API_KEY || 
  process.env.NEXTMV_API_KEY ||
  'nxmvv1_lhcoj3zDR:f5d1c365105ef511b4c47d67c6c13a729c2faecd36231d37dcdd2fcfffd03a6813235230';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, accept',
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get the path from the request
    const path = Array.isArray(req.query.path) 
      ? req.query.path.join('/') 
      : req.query.path || '';
    
    // Build the target URL with query string if present
    let targetUrl = `${NEXTMV_API_BASE}/${path}`;
    if (req.url && req.url.includes('?')) {
      const queryString = req.url.substring(req.url.indexOf('?'));
      targetUrl += queryString;
    }

    // Prepare headers
    const headers: HeadersInit = {
      'Authorization': `Bearer ${NEXTMV_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Get request body if present
    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = JSON.stringify(req.body);
    }

    // Make the request to NextMV API
    const response = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers,
      body,
    });

    // Get response data
    const data = await response.text();
    let jsonData: any;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = data;
    }

    // Return response with CORS headers
    res.status(response.status).json(jsonData);
  } catch (error: any) {
    console.error('NextMV Proxy Error:', error);
    res.status(500).json({
      error: 'Proxy error',
      message: error.message,
    });
  }
}
