import type { Container } from './timeline-items/container';
import type { Demo } from './timeline-items/demo';
import type { VideoClip } from './timeline-items/video';

type integer = number;

export interface Project {
  appCommit?: string;
  width: integer;
  height: integer;
  audioSampleRate: integer;
  fps: number;
  childrenTimeline: ChildrenTimelineItem[];
}

export type ChildrenTimelineItem = VideoClip | Container | Demo;

export interface ChildrenTimelineItemBase extends TimelineItemBase {
  /** Duration. 00:00:00.000 or ms */
  duration: string | number;
}

export interface TimelineItemBase {
  /** Start time. 00:00:00.000 or ms */
  start: string | number;
}
