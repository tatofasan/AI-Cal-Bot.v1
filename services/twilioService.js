// src/services/twilioService.js
import Twilio from "twilio";

const TWILIO_ACCOUNT_SID = "ACb593668600bd12b6cc9289e1b8e4f74d";
const TWILIO_AUTH_TOKEN = "c32049560b9edbc746c89823d42b4ac8";
const TWILIO_PHONE_NUMBER = "+17346276080";
const TWILIO_BYOC_TRUNK_SID = "BY95c610d7381f4a0c2e961ab2412a4c3c";
const TO_PHONE_NUMBER = "+541169205200";

const twilioClient = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

export const twilioCall = async ({ prompt, first_message, to_number }) => {
  const destinationNumber = to_number || TO_PHONE_NUMBER;
  // Get the ngrok URL from global context or environment
  const publicUrl = global.publicUrl || process.env.PUBLIC_URL;
  if (!publicUrl) {
    throw new Error("No public URL available for Twilio call");
  }
  const call = await twilioClient.calls.create({
    from: TWILIO_PHONE_NUMBER,
    to: destinationNumber,
    url: `${publicUrl}/outbound-call-twiml?prompt=${encodeURIComponent(
      prompt,
    )}&first_message=${encodeURIComponent(first_message)}`,
    byoc: TWILIO_BYOC_TRUNK_SID,
  });
  return {
    success: true,
    message: "Call initiated",
    callSid: call.sid,
    destinationNumber,
  };
};
