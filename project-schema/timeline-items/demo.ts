import type { ChildrenTimelineItemBase, TimelineItemBase } from '../schema';

export interface Demo extends ChildrenTimelineItemBase {
  type: 'demo';
  /** Relative path to JS file */
  scriptSource?: string;
  /** Relative path to CSS file */
  styleSource?: string;
  timeline?: DemoTimelineItem[];
}

type DemoTimelineItem = DemoTimelineItemMessage;

interface DemoTimelineItemMessage extends TimelineItemBase {
  type: 'message';
  data: any;
}
