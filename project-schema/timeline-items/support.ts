import type { ChildrenTimelineItemBase, TimelineItemBase } from '../schema';

export type Support = ChildrenTimelineItemBase & {
  type: 'support';
  timeline?: SupportTimelineItem[];
};

export type SupportTimelineItem = SupportTimelineItemBrowser;

export interface SupportTimelineItemBrowser extends TimelineItemBase {
  type: 'browser';
  browser: 'chrome' | 'firefox' | 'safari';
  version: string;
}
