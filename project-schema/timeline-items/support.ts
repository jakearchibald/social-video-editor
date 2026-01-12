import type { ChildrenTimelineItemBase, TimelineItemBase } from '../schema';

export interface Support extends ChildrenTimelineItemBase {
  type: 'support';
  timeline?: SupportTimelineItem[];
}

export type SupportTimelineItem = SupportTimelineItemBrowser;

export interface SupportTimelineItemBrowser extends TimelineItemBase {
  type: 'browser';
  browser: 'chrome' | 'firefox' | 'safari';
  version: string;
  partial?: boolean;
}
