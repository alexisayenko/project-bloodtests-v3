import { TABLE_TD, TABLE_TH } from '../primitives/styles';

export const th = { ...TABLE_TH, fontSize: 13 } as const;
export const td = { ...TABLE_TD, fontSize: 13 } as const;
export const wrapTd = { ...td, whiteSpace: 'normal' } as const;
