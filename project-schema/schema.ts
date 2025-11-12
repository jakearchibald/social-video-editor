import type { Code } from './timeline-items/code';
import type { Container } from './timeline-items/container';
import type { Demo } from './timeline-items/demo';
import type { Title } from './timeline-items/title';
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

export type ChildrenTimelineItem = VideoClip | Container | Demo | Code | Title;

export interface ChildrenTimelineItemBase extends TimelineItemBase {
  /** Duration. 00:00:00.000 or ms */
  duration: string | number;
  /** Ignore this entry (for debugging) */
  disabled?: boolean;
}

export interface TimelineItemBase {
  /** Start time. 00:00:00.000 or ms */
  start: string | number;
}
