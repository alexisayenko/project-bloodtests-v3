import { GoogleAuthProvider, OAuthProvider, getAuth, signInWithPopup, signOut } from 'firebase/auth';
import { firebaseApp } from './config';

export const auth = getAuth(firebaseApp);

export function signInWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function signInWithApple() {
  return signInWithPopup(auth, new OAuthProvider('apple.com'));
}

export function signOutUser() {
  return signOut(auth);
}
