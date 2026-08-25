import type { ChildrenTimelineItemBase } from '../schema';

export interface Audio extends ChildrenTimelineItemBase {
  type: 'audio';
  /** Relative path to audio file */
  source: string;
  /** 0-1 volume. Defaults to 1 */
  volume?: number;
}
