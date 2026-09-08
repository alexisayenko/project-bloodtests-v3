// Small, fixed, colorblind-safe categorical palette (Okabe-Ito with its
// yellow darkened to an amber that stays readable on white, and black
// appended as an 8th slot) -- v3 has no existing categorical/series palette
// to reuse. Each selected biomarker owns one slot (`colorIndex`, assigned by
// the host page) for as long as it stays selected, so toggling a neighbour
// never recolors it.
export const PALETTE: readonly (readonly [number, number, number])[] = [
  [230, 159, 0],
  [86, 180, 233],
  [0, 158, 115],
  [204, 153, 0],
  [0, 114, 178],
  [213, 94, 0],
  [204, 121, 167],
  [0, 0, 0],
];

export const MAX_SERIES = PALETTE.length;
