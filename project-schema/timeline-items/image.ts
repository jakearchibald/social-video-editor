import type { ChildrenTimelineItemBase } from '../schema';

export interface Image extends ChildrenTimelineItemBase {
  type: 'image';
  /** Relative path to image file */
  source: string;
}
