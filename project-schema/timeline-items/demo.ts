import type { ChildrenTimelineItemBase, TimelineItemBase } from '../schema';

export type Demo = ChildrenTimelineItemBase & {
  type: 'demo';
  /** Relative path to JS file */
  scriptSource?: string;
  /** Relative path to CSS file */
  styleSource?: string;
  /** A directory to expose as static asset object URLs */
  assetsDir?: string;
  timeline?: DemoTimelineItem[];
};

export type DemoTimelineItem = DemoTimelineItemMessage;

interface DemoTimelineItemMessage extends TimelineItemBase {
  type: 'message';
  data: any;
}
