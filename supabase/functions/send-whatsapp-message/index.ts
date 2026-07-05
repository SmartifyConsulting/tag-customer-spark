import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
const twilioPhoneNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
    });
  }

  try {
    const { phoneNumber, message, campaignId, storeId } = await req.json();

    // Validate input
    if (!phoneNumber || !message || !storeId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    // Send via Twilio WhatsApp
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    
    const formData = new FormData();
    formData.append("From", `whatsapp:${twilioPhoneNumber}`);
    formData.append("To", `whatsapp:${phoneNumber}`);
    formData.append("Body", message);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          btoa(`${twilioAccountSid}:${twilioAuthToken}`),
      },
      body: formData,
    });

    const twilioData = await twilioResponse.json() as any;

    // Log message to database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (twilioResponse.ok) {
      await supabase.from("whatsapp_messages").insert({
        store_id: storeId,
        customer_phone: phoneNumber,
        message_content: message,
        campaign_id: campaignId,
        status: "sent",
        sent_at: new Date().toISOString(),
        twilio_message_sid: twilioData.sid,
      });

      return new Response(
        JSON.stringify({
          success: true,
          messageId: twilioData.sid,
          status: "sent",
        }),
        { status: 200 }
      );
    } else {
      await supabase.from("whatsapp_messages").insert({
        store_id: storeId,
        customer_phone: phoneNumber,
        message_content: message,
        campaign_id: campaignId,
        status: "failed",
        error_message: twilioData.message,
      });

      return new Response(
        JSON.stringify({
          error: "Failed to send WhatsApp message",
          details: twilioData,
        }),
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("WhatsApp send error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
