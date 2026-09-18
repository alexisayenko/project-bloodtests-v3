import { supabaseClient } from './config';

// laboratory-prices.json is deliberately absent: the shipped registry always wins.
const FIELD_BY_FILE: Record<string, string> = {
  'manifest.json': 'manifest',
  'lab-reports.json': 'lab_reports',
  'medications.json': 'medications',
  'scheduled-visits.json': 'scheduled_visits',
  'settings.json': 'settings',
};

export async function pullCloudFiles(uid: string): Promise<Record<string, string> | null> {
  const { data, error } = await supabaseClient
    .from('user_backups')
    .select('manifest, lab_reports, medications, scheduled_visits, settings')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const files: Record<string, string> = {};
  for (const [file, field] of Object.entries(FIELD_BY_FILE)) {
    if (row[field] !== null && row[field] !== undefined) files[file] = JSON.stringify(row[field]);
  }
  return files;
}

export async function pushCloudFiles(uid: string, files: Record<string, string>): Promise<void> {
  const row: Record<string, unknown> = { id: uid };
  for (const [file, field] of Object.entries(FIELD_BY_FILE)) {
    if (files[file] !== undefined) row[field] = JSON.parse(files[file]);
  }
  const { error } = await supabaseClient.from('user_backups').upsert(row);
  if (error) throw error;
}
