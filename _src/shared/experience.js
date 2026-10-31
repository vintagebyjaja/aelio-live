// Public product language only. Diagnostic codes stay separate from consumer copy.
export const EXPERIENCE_STATES=Object.freeze({ready:'What’s on your mind today?',loading:'Getting your space ready…',processing:'Working on it…',action:'One more step and you’re ready.',unavailable:'I can’t do that here right now. Let’s try another way.',not_offered:'Let’s explore what you can do here.',interrupted:'We lost our connection for a moment. Want to pick up where we left off?',authentication:'Sign in to make this space yours.',completed:'You’re all set.',failed:'That didn’t go through. Your work is still here.'});
const errors={
 character_setup_required:"Character saving needs a storage update. Your agent and conversations are unchanged.",
 native_setup_required:"Native Brain project and wallet storage needs a setup update. Existing chats and tools remain available.",
 engine_not_connected:"This part of your space needs a moment. You can keep exploring or try again.",
 engine_unreachable:"I can’t open that right now. Please try again shortly.",
 session_not_configured:'I’m having a little trouble opening your space. Let’s try again.',
 auth_not_configured:'Sign-in needs a moment. Please try again shortly. Your password has not been sent.',
 auth_key_rejected:'Sign-in needs a moment. Please try again shortly. Your password has not been sent.',
 server_credentials_rejected:'Your sign-in is active, but account storage is temporarily unavailable. Please try again shortly.',
 database_not_configured:'I’m having trouble opening your account right now. Please try again.',
 database_unavailable:'I’m having trouble opening your account right now. Please try again.',
 database_failure:'I couldn’t save that change. Please try again.',
 account_setup_required:'Your account needs a moment to get ready. You can keep exploring and try again.',
 engine_not_configured:'I can’t start a reply right now. Your message is here when you’re ready to retry.',
 provider_not_configured:'I can’t start a reply right now. Your message is here when you’re ready to retry.',
 provider_authentication:'I can’t start a reply right now. Please try again shortly.',
 provider_timeout:'The reply is taking longer than expected. You can stop and retry.',
 stream_interrupted:EXPERIENCE_STATES.interrupted,
 internal_failure:'That didn’t go through. Please try again.',
 authentication_required:EXPERIENCE_STATES.authentication,
 authentication_failed:'Please sign in again to continue.',
 storage_not_configured:'I can’t open your files right now. Please try again shortly.',
};
export function consumerMessage(code,message){
 if(errors[code])return errors[code];
 if(typeof message!=='string'||message.length>500)return EXPERIENCE_STATES.failed;
 if(/supabase|cloudflare|service.role|runtime|environment.variable|not configured|contact.*owner|api key|stack trace|postgrest|PGRST|SQLSTATE|backend|\bat [\w.]+\s*\(/i.test(message))return EXPERIENCE_STATES.unavailable;
 return message||EXPERIENCE_STATES.failed;
}
