// Domain-free approximate token matching: Damerau-Levenshtein distance plus a
// length-bucketed vocabulary index, tuned for lab typos (CORTIZOL, Thyroxin).

// Two tokens count as equal when identical, or within Damerau-Levenshtein
// distance 1 for length ≥ 5 (both sides), or distance 2 for length ≥ 9.
// Short tokens get no slack — "hb" must never equal "hgb" by accident.
const FUZZY1_MIN_LEN = 5;
const FUZZY2_MIN_LEN = 9;

function capForShorterLength(shorter: number): number {
  if (shorter >= FUZZY2_MIN_LEN) return 2;
  if (shorter >= FUZZY1_MIN_LEN) return 1;
  return 0;
}

function fuzzyCap(a: string, b: string): number {
  return capForShorterLength(Math.min(a.length, b.length));
}

// One row of the OSA Damerau-Levenshtein matrix.
function editDistanceRow(
  a: string,
  b: string,
  i: number,
  prev: number[],
  prev2: number[]
): { row: number[]; rowMin: number } {
  const row: number[] = [i];
  let rowMin = i;
  for (let j = 1; j <= b.length; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    let d = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
      d = Math.min(d, prev2[j - 2]! + 1);
    }
    row[j] = d;
    if (d < rowMin) rowMin = d;
  }
  return { row, rowMin };
}

// Optimal-string-alignment Damerau-Levenshtein, early-exiting once a whole
// row exceeds the cap.
function editDistanceWithin(a: string, b: string, cap: number): boolean {
  if (cap <= 0) return false;
  if (Math.abs(a.length - b.length) > cap) return false;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const { row, rowMin } = editDistanceRow(a, b, i, prev, prev2);
    if (rowMin > cap) return false;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length]! <= cap;
}

export function tokensFuzzyEqual(a: string, b: string): boolean {
  return a === b || editDistanceWithin(a, b, fuzzyCap(a, b));
}

// Vocabulary grouped by token length, so a fuzzy lookup only compares against
// tokens whose length is within the allowed edit distance.
export function groupVocabByLength(vocab: Iterable<string>): Map<number, string[]> {
  const byLen = new Map<number, string[]>();
  for (const t of vocab) {
    const group = byLen.get(t.length);
    if (group) group.push(t);
    else byLen.set(t.length, [t]);
  }
  return byLen;
}

export function fuzzyVocabHits(token: string, vocabByLen: Map<number, string[]>): string[] {
  const hits: string[] = [];
  for (let len = token.length - 2; len <= token.length + 2; len++) {
    const group = vocabByLen.get(len);
    if (!group) continue;
    const cap = capForShorterLength(Math.min(token.length, len));
    if (cap === 0 || Math.abs(token.length - len) > cap) continue;
    for (const v of group) {
      if (v !== token && editDistanceWithin(token, v, cap)) hits.push(v);
    }
  }
  return hits;
}
