import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-url",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const NEXTMV_API_BASE = "https://api.cloud.nextmv.io";
const NEXTMV_API_KEY =
  Deno.env.get("NEXTMV_API_KEY") ||
  "nxmvv1_lhcoj3zDR:f5d1c365105ef511b4c47d67c6c13a729c2faecd36231d37dcdd2fcfffd03a6813235230";

serve(async (req) => {
  // Preflight handler for browsers
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Don't validate authentication - Supabase will handle it
    // Just proceed with the proxy request
    const url = new URL(req.url);
    
    // Get path from URL or from request body (for invoke calls)
    let forwardedPath = url.pathname.replace(/^\/?nextmv-proxy/, "") || "/";
    let requestBody: any = null;
    
    // If path is empty, try to get it from request body (when called via functions.invoke)
    let httpMethod = req.method;
    if (forwardedPath === "/" && req.method === "POST") {
      try {
        const bodyJson = await req.json();
        if (bodyJson.path) {
          forwardedPath = bodyJson.path;
        }
        if (bodyJson.method) {
          httpMethod = bodyJson.method;
        }
        if (bodyJson.body) {
          requestBody = bodyJson.body;
        } else if (httpMethod === "GET" || httpMethod === "HEAD") {
          requestBody = undefined;
        }
      } catch {
        // If parsing fails, use original body
        requestBody = await req.arrayBuffer();
      }
    } else {
      requestBody = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
    }
    
    const targetUrl = `${NEXTMV_API_BASE}${forwardedPath}${url.search}`;

    // Forward original headers but override auth with the server-side key
    const outgoingHeaders = new Headers(req.headers);
    outgoingHeaders.set("Authorization", `Bearer ${NEXTMV_API_KEY}`);
    outgoingHeaders.set("Content-Type", "application/json");
    outgoingHeaders.delete("host");
    outgoingHeaders.delete("connection");
    outgoingHeaders.delete("apikey"); // Remove apikey before forwarding to NextMV

    // Convert body to appropriate format
    let finalBody: BodyInit | undefined = undefined;
    if (requestBody && (httpMethod === "POST" || httpMethod === "PUT" || httpMethod === "PATCH")) {
      if (typeof requestBody === 'object' && !(requestBody instanceof ArrayBuffer)) {
        finalBody = JSON.stringify(requestBody);
      } else if (requestBody instanceof ArrayBuffer) {
        finalBody = requestBody;
      }
    }
    
    const response = await fetch(targetUrl, {
      method: httpMethod,
      headers: outgoingHeaders,
      body: finalBody,
    });

    // Copy response headers and apply CORS
    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("nextmv-proxy error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

