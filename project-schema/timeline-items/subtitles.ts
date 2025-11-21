import type { ChildrenTimelineItemBase } from '../schema';

export type Subtitles = ChildrenTimelineItemBase & {
  type: 'subtitles';
  /** Relative path to subtitles JSON file */
  source: string;
  /** Timestamp for subtitle start point */
  subtitlesStart: number | string;
};
