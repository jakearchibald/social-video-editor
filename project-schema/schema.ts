import type { Container } from './timeline-items/container';
import type { Support } from './timeline-items/support';

type integer = number;

export interface Project {
  appCommit?: string;
  width: integer;
  height: integer;
  fps: number;
  start?: string | number;
  /** End time */
  end: string | number;
  childrenTimeline: ChildrenTimelineItem[];
}

export type ChildrenTimelineItem = Container | Support;

export interface ChildrenTimelineItemBase {
  /** Start time. 00:00:00.000 or ms. Defaults to the start of the parent. */
  start?: string | number;
  /** Duration. 00:00:00.000 or ms. Defaults to the end of the parent. */
  duration?: string | number;
  /** End time. 00:00:00.000 or ms. Defaults to the end of the parent. */
  end?: string | number;
  /** Ignore this entry (for debugging) */
  disabled?: boolean;
}

export interface TimelineItemBase {
  /** Start time. 00:00:00.000 or ms */
  start: string | number;
}
