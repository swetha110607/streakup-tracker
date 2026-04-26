// Generates dynamic form fields for a custom habit using Lovable AI tool calling.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FieldDef {
  key: string; // snake_case identifier
  label: string; // human label
  type: "text" | "number" | "textarea";
  placeholder?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { habit_name } = await req.json();
    if (typeof habit_name !== "string" || !habit_name.trim()) {
      return new Response(JSON.stringify({ error: "habit_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt =
      "You design daily-log form fields for habit tracking apps. Given a habit name, " +
      "return 2 to 3 of the MOST relevant fields a user would log each day for that habit. " +
      "Use clear human labels. Pick the appropriate input type: 'number' for counts/durations/amounts, " +
      "'text' for short titles or names, 'textarea' for descriptions. Use snake_case for keys. " +
      "Do NOT include a 'note' field — that is added separately.";

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Habit name: "${habit_name}". Return 2-3 daily-log fields.`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "define_fields",
                description: "Define 2-3 form fields for the habit",
                parameters: {
                  type: "object",
                  properties: {
                    fields: {
                      type: "array",
                      minItems: 2,
                      maxItems: 3,
                      items: {
                        type: "object",
                        properties: {
                          key: { type: "string" },
                          label: { type: "string" },
                          type: {
                            type: "string",
                            enum: ["text", "number", "textarea"],
                          },
                          placeholder: { type: "string" },
                        },
                        required: ["key", "label", "type"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["fields"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "define_fields" },
          },
        }),
      },
    );

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached, try again shortly." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI credits exhausted. Add credits in Workspace settings.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    if (!args) {
      return new Response(
        JSON.stringify({ error: "No fields generated" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const parsed = JSON.parse(args) as { fields: FieldDef[] };
    return new Response(JSON.stringify({ fields: parsed.fields }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-habit-fields error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
