import type { ChildrenTimelineItemBase, TimelineItemBase } from '../schema';
import type { VolumeChange } from './volume-change';

export interface Audio extends ChildrenTimelineItemBase {
  type: 'audio';
  /** Relative path to audio file */
  source: string;
  /** 0-1 volume. Defaults to 1 */
  volume?: number;
  /** Loop the audio once it reaches `loopEnd` */
  loop?: boolean;
  /** Time within the audio file to loop back to. 00:00:00.000 or ms. Defaults to 0 */
  loopStart?: string | number;
  /** Time within the audio file at which to loop. 00:00:00.000 or ms. Defaults to the end of the file */
  loopEnd?: string | number;
  /** Playback rate of the audio, where 1 is normal */
  playbackRate?: number;
  timeline?: AudioClipTimelineItem[];
}

export type AudioClipTimelineItem = AudioTimeChange | VolumeChange;

export interface AudioTimeChange extends TimelineItemBase {
  type: 'time-change';
  playbackRate?: number;
  /** New time within the audio file. 00:00:00.000 or ms */
  audioTime?: string | number;
}
