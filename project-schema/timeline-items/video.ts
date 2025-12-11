import type { ChildrenTimelineItemBase, TimelineItemBase } from '../schema';

export interface VideoClip extends ChildrenTimelineItemBase {
  type: 'video';
  /** Relative path to video file */
  source: string;
  /** Relative path to audio file, used instead of video audio. Null to ignore video audio. */
  audioSource?: string | null;
  /** Start time within the video file. 00:00:00.000 or ms */
  videoStart?: string | number;
  /** Start time within the audio file. 00:00:00.000 or ms */
  audioStart?: string | number;
  /** Delay in milliseconds to apply to audio playback. Positive values delay audio, negative values play audio earlier. 00:00:00.000 or ms */
  audioDelay?: string | number;
  /** Playback rate of the video, where 1 is normal */
  playbackRate?: number;
  timeline?: VideoClipTimelineItem[];
}

export type VideoClipTimelineItem = VideoClipTimeChange;

export interface VideoClipTimeChange extends TimelineItemBase {
  type: 'time-change';
  playbackRate?: number;
  /** New time within the video file. 00:00:00.000 or ms */
  videoTime?: string | number;
}
