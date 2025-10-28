type integer = number;

export interface Project {
  appCommit?: string;
  width: integer;
  height: integer;
  fps: number;
  timeline: TimelineItem[];
}

type TimelineItem = VideoClip;

interface TimelineBase {
  /** Start time */
  start: string;
  /** Duration */
  duration: string;
}

interface VideoClip extends TimelineBase {
  type: 'video';
  /** Relative path to video file */
  source: string;
  videoStart?: string;
}
