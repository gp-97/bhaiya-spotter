import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://gp-97.github.io/bhaiya-spotter";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { event, actorName, imageUrl } = await req.json();
    let subject = "";
    let body = "";

    if (event === "new_submission") {
      subject = `${actorName} spotted Bhaiya!`;
      body = `${actorName} just uploaded a new photo. Check it out!`;
    } else if (event === "new_comment") {
      subject = `${actorName} commented on a photo`;
      body = `${actorName} left a new comment.`;
    }

    const { data: users } = await supabase.auth.admin.listUsers();
    const emails = users
      ?.map((u: any) => u.email)
      .filter((e: string) => e && e.length > 0) || [];

    if (emails.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Bhaiya Radar <notifications@bhaiya-radar.dev>",
        to: emails,
        subject,
        html: `<p>${body}</p><p><a href="${SITE_URL}/gallery.html">View Gallery</a></p>`,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${res.status} ${err}`);
    }

    const data = await res.json();
    return new Response(JSON.stringify({ sent: emails.length, id: data.id }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
