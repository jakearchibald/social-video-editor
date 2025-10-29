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
  /** Start time. 00:00:00.000 or ms */
  start: string | number;
  /** Duration. 00:00:00.000 or ms */
  duration: string | number;
}

interface VideoClip extends TimelineBase {
  type: 'video';
  /** Relative path to video file */
  source: string;
  /** Start time within the video file. 00:00:00.000 or ms */
  videoStart?: string | number;
}
