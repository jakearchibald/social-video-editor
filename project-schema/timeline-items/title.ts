import type { ChildrenTimelineItemBase } from '../schema';

export interface Title extends ChildrenTimelineItemBase {
  type: 'title';
  text: string;
  fontSize?: string;
}
