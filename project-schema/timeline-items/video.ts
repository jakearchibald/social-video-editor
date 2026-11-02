import type { ChildrenTimelineItemBase, TimelineItemBase } from '../schema';
import type { VolumeChange } from './volume-change';

export interface VideoClip extends ChildrenTimelineItemBase {
  type: 'video';
  /** Relative path to video file */
  source: string;
  /**
   * Relative path to a lower quality version of the video, used in the editor to make scrubbing
   * faster. The full quality source is used when outputting.
   */
  proxySource?: string;
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
  /** 0-1 volume of the audio. Defaults to 1 */
  volume?: number;
  /** Path to a poster image, used instead of the first frame */
  posterImage?: (
    | { source: string }
    | {
        /** Point within the video file. 00:00:00.000 or ms */
        frameTime: string | number;
      }
  ) & {
    /** Defaults to 1ms */
    duration?: string | number;
  };
  timeline?: VideoClipTimelineItem[];
}

export type VideoClipTimelineItem = VideoClipTimeChange | VolumeChange;

export interface VideoClipTimeChange extends TimelineItemBase {
  type: 'time-change';
  playbackRate?: number;
  /** New time within the video file. 00:00:00.000 or ms */
  videoTime?: string | number;
}
