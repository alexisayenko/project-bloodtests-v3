import type { ScheduledVisit } from '../../data/storage/scheduledVisits';

/** One visit's Scheduled column wiring, handed to every table that renders it. */
export type RowScheduling = {
  scheduled: ScheduledVisit;
  onToggle: (loincs: string[]) => void;
  onSetMonth: (month: string | undefined) => void;
  onRemove: () => void;
};
export type IndexScheduling = {
  scheduled: ScheduledVisit;
  onToggle: (key: string) => void;
  onSetMonth: (month: string | undefined) => void;
  onRemove: () => void;
};
