import type { ChildrenTimelineItemBase } from '../schema';

export interface VideoClip extends ChildrenTimelineItemBase {
  type: 'video';
  /** Relative path to video file */
  source: string;
  /** Relative path to audio file, used instead of video audio. Null to ignore video audio. */
  audioSource?: string | null;
  /** Start time within the video file. 00:00:00.000 or ms */
  videoStart?: string | number;
}
