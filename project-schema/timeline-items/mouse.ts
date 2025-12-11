import type { ChildrenTimelineItemBase, TimelineItemBase } from '../schema';

export interface Mouse extends ChildrenTimelineItemBase {
  type: 'mouse';
  top: number;
  left: number;
  scale?: number;
  timeline?: MouseTimelineItem[];
}

export type MouseTimelineItem = MousePositionChange | MouseClick;

export interface MousePositionChange extends TimelineItemBase {
  type: 'position';
  top: number;
  left: number;
  duration: number;
}

export interface MouseClick extends TimelineItemBase {
  type: 'click';
}
