import type { ChildrenTimelineItemBase } from '../schema';

export type Image = ChildrenTimelineItemBase & {
  type: 'image';
  /** Relative path to image file */
  source: string;
};
