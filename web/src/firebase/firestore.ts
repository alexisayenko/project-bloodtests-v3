import { doc, getDoc, getFirestore, setDoc, type DocumentData } from 'firebase/firestore';
import { firebaseApp } from './config';

export const db = getFirestore(firebaseApp);

// Maps a backup-bundle filename to the Firestore field it lives in on
// `users/{uid}`. laboratory-prices.json is deliberately absent: the shipped
// registry always wins, so it is never pushed or pulled (backupRestore.ts's
// laboratoryPricesLine).
const FIELD_BY_FILE: Record<string, string> = {
  'manifest.json': 'manifest',
  'lab-reports.json': 'labReports',
  'medications.json': 'medications',
  'scheduled-visits.json': 'scheduledVisits',
  'settings.json': 'settings',
};

function userDoc(uid: string) {
  return doc(db, 'users', uid);
}

export async function pullCloudFiles(uid: string): Promise<Record<string, string> | null> {
  const snap = await getDoc(userDoc(uid));
  if (!snap.exists()) return null;
  const data: DocumentData = snap.data();
  const files: Record<string, string> = {};
  for (const [file, field] of Object.entries(FIELD_BY_FILE)) {
    if (field in data) files[file] = JSON.stringify(data[field]);
  }
  return files;
}

export async function pushCloudFiles(uid: string, files: Record<string, string>): Promise<void> {
  const data: Record<string, unknown> = {};
  for (const [file, field] of Object.entries(FIELD_BY_FILE)) {
    if (files[file] !== undefined) data[field] = JSON.parse(files[file]);
  }
  await setDoc(userDoc(uid), data);
}
