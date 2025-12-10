import type { Code } from './timeline-items/code';
import type { Container } from './timeline-items/container';
import type { Demo } from './timeline-items/demo';
import type { Image } from './timeline-items/image';
import type { Subtitles } from './timeline-items/subtitles';
import type { Support } from './timeline-items/support';
import type { Title } from './timeline-items/title';
import type { VideoClip } from './timeline-items/video';

type integer = number;

export interface Project {
  appCommit?: string;
  width: integer;
  height: integer;
  audioSampleRate: integer;
  fps: number;
  /** End time */
  end: string | number;
  childrenTimeline: ChildrenTimelineItem[];
}

export type ChildrenTimelineItem =
  | VideoClip
  | Container
  | Demo
  | Code
  | Title
  | Image
  | Subtitles
  | Support;

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
