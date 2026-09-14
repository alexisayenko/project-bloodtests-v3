import { createClient } from '@supabase/supabase-js';

// Same as firebase/config.ts's convention: this key is designed for public
// client exposure (RLS is the real access boundary), so it's hardcoded here
// rather than plumbed through build-time env vars.
const supabaseUrl = 'https://api.paneloom.com';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg5Mzc3OTM3LCJleHAiOjE5NDcwNTc5Mzd9.T09I_Nfjdr5qRIY60fsEid1NUK9N6RETxS9ApPyBiYY';

// PKCE flow returns the session via a `?code=` query param instead of a `#access_token=`
// hash fragment -- required here because the app's own router already owns the URL hash
// (`#account`, `#reports`, ...), which collides with Supabase's default implicit-flow redirect.
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { flowType: 'pkce' } });
