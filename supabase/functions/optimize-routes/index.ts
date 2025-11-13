import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NEXTMV_API_KEY = Deno.env.get("NEXTMV_API_KEY");
    if (!NEXTMV_API_KEY) {
      throw new Error("NEXTMV_API_KEY is not configured");
    }

    const { pickupPoints, vehicles } = await req.json();
    console.log("Optimizing routes for:", { pickupPoints: pickupPoints.length, vehicles: vehicles.length });

    // Format data for Nextmv API
    const nextmvRequest = {
      defaults: {
        vehicles: {
          speed: 10,
          start_time: "2025-01-01T08:00:00Z",
          end_time: "2025-01-01T18:00:00Z"
        }
      },
      stops: pickupPoints.map((point: any, index: number) => ({
        id: point.id,
        location: {
          lon: parseFloat(point.longitude),
          lat: parseFloat(point.latitude)
        },
        quantity: [1]
      })),
      vehicles: vehicles.map((vehicle: any) => ({
        id: vehicle.id,
        start_location: vehicle.start_location ? {
          lon: vehicle.start_location.longitude,
          lat: vehicle.start_location.latitude
        } : {
          lon: pickupPoints[0].longitude,
          lat: pickupPoints[0].latitude
        },
        capacity: [vehicle.capacity],
        max_distance: vehicle.max_distance || 1000000
      }))
    };

    console.log("Sending request to Nextmv:", JSON.stringify(nextmvRequest, null, 2));

    // Call Nextmv API
    const response = await fetch("https://api.nextmv.io/v1/runs", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NEXTMV_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instance_id: "cvrp",
        input: nextmvRequest,
        options: {
          solve: {
            duration: "10s"
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Nextmv API error:", response.status, errorText);
      throw new Error(`Nextmv API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log("Nextmv response:", JSON.stringify(result, null, 2));

    // Store routes in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse and store routes
    if (result.solutions && result.solutions.length > 0) {
      const solution = result.solutions[0];
      
      for (const vehicle of solution.vehicles || []) {
        const routeData = {
          vehicle_id: vehicle.id,
          route_data: vehicle,
          total_distance: vehicle.route_distance || 0,
          total_duration: vehicle.route_duration || 0
        };

        await supabase.from("routes").insert(routeData);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in optimize-routes:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
