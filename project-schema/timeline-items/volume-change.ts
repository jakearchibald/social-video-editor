import type { TimelineItemBase } from '../schema';

export interface VolumeChange extends TimelineItemBase {
  type: 'volume-change';
  /** 0-1 volume */
  volume: number;
  /** Duration of the fade to the new volume. 00:00:00.000 or ms. Defaults to 0 (instant) */
  duration?: string | number;
}
