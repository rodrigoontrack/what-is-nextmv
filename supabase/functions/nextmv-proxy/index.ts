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
    // Get the apikey from headers (Supabase uses this for public functions)
    const apikey = req.headers.get("apikey");
    const authHeader = req.headers.get("authorization");
    
    // If no apikey or authorization header, return 401
    // But we'll accept either apikey or authorization with anon key
    if (!apikey && !authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing apikey or authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const url = new URL(req.url);
    // Strip the function prefix to forward only the Nextmv path
    const forwardedPath = url.pathname.replace(/^\/?nextmv-proxy/, "") || "/";
    const targetUrl = `${NEXTMV_API_BASE}${forwardedPath}${url.search}`;

    const body =
      req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();

    // Forward original headers but override auth with the server-side key
    const outgoingHeaders = new Headers(req.headers);
    outgoingHeaders.set("Authorization", `Bearer ${NEXTMV_API_KEY}`);
    outgoingHeaders.delete("host");
    outgoingHeaders.delete("connection");
    outgoingHeaders.delete("apikey"); // Remove apikey before forwarding to NextMV

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: outgoingHeaders,
      body,
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

