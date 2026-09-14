import { supabaseClient } from './config';

export const supabase = supabaseClient;

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
}

export function signInWithApple() {
  return supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: window.location.href } });
}

export function signOutUser() {
  return supabase.auth.signOut();
}
