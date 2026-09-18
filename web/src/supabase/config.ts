import { createClient } from '@supabase/supabase-js';

// The anon key is designed for public client exposure; RLS is the real access boundary.
const supabaseUrl = 'https://api.paneloom.com';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg5Mzc3OTM3LCJleHAiOjE5NDcwNTc5Mzd9.T09I_Nfjdr5qRIY60fsEid1NUK9N6RETxS9ApPyBiYY';

// PKCE returns the session as `?code=`; the implicit flow's `#access_token=`
// would collide with the app's own hash router.
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { flowType: 'pkce' } });
