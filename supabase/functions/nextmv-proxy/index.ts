import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const NEXTMV_API_BASE_URL = "https://api.cloud.nextmv.io";
const NEXTMV_API_KEY = Deno.env.get("NEXTMV_API_KEY") || "nxmvv1_lhcoj3zDR:f5d1c365105ef511b4c47d67c6c13a729c2faecd36231d37dcdd2fcfffd03a6813235230";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the path from the request URL
    // Expected format: /nextmv-proxy/v1/applications/...
    const url = new URL(req.url);
    const pathMatch = url.pathname.match(/\/nextmv-proxy\/(.+)/);
    
    if (!pathMatch) {
      return new Response(
        JSON.stringify({ error: "Invalid proxy path. Expected format: /nextmv-proxy/v1/..." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiPath = pathMatch[1];
    const targetUrl = `${NEXTMV_API_BASE_URL}/${apiPath}`;

    // Forward query parameters
    const queryString = url.search;
    const fullUrl = queryString ? `${targetUrl}${queryString}` : targetUrl;

    console.log(`Proxying ${req.method} request to: ${fullUrl}`);

    // Get request body if present
    let body: string | undefined;
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      try {
        body = await req.text();
      } catch (e) {
        // No body or error reading body
      }
    }

    // Forward the request to Nextmv API
    const response = await fetch(fullUrl, {
      method: req.method,
      headers: {
        "Authorization": `Bearer ${NEXTMV_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: body,
    });

    // Get response body
    const responseText = await response.text();
    
    // Return the response with CORS headers
    return new Response(responseText, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...corsHeaders,
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("Error in nextmv-proxy:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

