// Public configuration for aelio.live. Nothing here is secret.
window.AELIO_CONFIG = {
  // The AELIO engine is reached on this same site at /api/... (no separate domain).
  engine: "",
  // Sign-in provider. "firebase" until Supabase passes every migration test; then "supabase".
  // Rollback = set this back to "firebase" (the engine accepts both while AELIO_AUTH_PROVIDERS lists both).
  auth: "firebase",
  // The shared AELIO/PATHD Supabase project: public URL + publishable (anon) key only. Never the service_role key.
  // When filled in, also add the URL to connect-src in public/_headers (npm run check enforces this).
  supabase: { url: "", anonKey: "" },
  firebase: {
    apiKey: "AIzaSyCIXYSt5u-Y-XFXNuf9gC0SbGu4azAcuzk",
    authDomain: "aelio-0820.firebaseapp.com",
    projectId: "aelio-0820",
    storageBucket: "aelio-0820.firebasestorage.app",
    messagingSenderId: "630737692474",
    appId: "1:630737692474:web:dfe9a4fb24d91d96841203"
  }
};
