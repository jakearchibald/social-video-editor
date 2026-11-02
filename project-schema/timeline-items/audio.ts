import type { ChildrenTimelineItemBase, TimelineItemBase } from '../schema';

export interface Audio extends ChildrenTimelineItemBase {
  type: 'audio';
  /** Relative path to audio file */
  source: string;
  /** 0-1 volume. Defaults to 1 */
  volume?: number;
  /** Playback rate of the audio, where 1 is normal */
  playbackRate?: number;
  timeline?: AudioClipTimelineItem[];
}

export type AudioClipTimelineItem = AudioTimeChange;

export interface AudioTimeChange extends TimelineItemBase {
  type: 'time-change';
  playbackRate?: number;
  /** New time within the audio file. 00:00:00.000 or ms */
  audioTime?: string | number;
}
