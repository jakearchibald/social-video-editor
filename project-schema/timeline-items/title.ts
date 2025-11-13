import type { ChildrenTimelineItemBase, TimelineItemBase } from '../schema';

export interface Title extends ChildrenTimelineItemBase {
  type: 'title';
  text: string;
  fontSize?: string;
  timeline?: TitleTimelineItem[];
}

export type TitleTimelineItem = TitleSmaller | TitleAway;

interface TitleSmaller extends TimelineItemBase {
  type: 'smaller';
}

interface TitleAway extends TimelineItemBase {
  type: 'away';
}
