import type { ChildrenTimelineItemBase } from '../schema';

export type Title = ChildrenTimelineItemBase & {
  type: 'title';
  text: string;
  fontSize?: string;
};
