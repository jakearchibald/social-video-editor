import type { ChildrenTimelineItemBase } from '../schema';

export type VideoClip = ChildrenTimelineItemBase & {
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
};
