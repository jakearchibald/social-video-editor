import type { VolumeChange } from '../../project-schema/timeline-items/volume-change';
import { parseTime } from './time';

export interface VolumeKeyframe {
  /** Absolute time, in ms */
  time: number;
  /** 0-1 volume */
  volume: number;
}

/**
 * Get keyframes for volume over time. The volume is linearly interpolated between keyframes, and
 * held before the first and after the last. Two keyframes at the same time represent an instant
 * change.
 */
export function getVolumeKeyframes(
  initialVolume: number,
  changes: VolumeChange[] = [],
): VolumeKeyframe[] {
  const sortedChanges = changes
    .map((change) => ({ ...change, start: parseTime(change.start) }))
    .sort((a, b) => a.start - b.start);

  let keyframes: VolumeKeyframe[] = [
    { time: -Infinity, volume: initialVolume },
  ];

  for (const change of sortedChanges) {
    const fromVolume = getVolume(keyframes, change.start);
    // A change interrupts any fade that's still in progress
    keyframes = keyframes.filter((keyframe) => keyframe.time <= change.start);
    keyframes.push(
      { time: change.start, volume: fromVolume },
      {
        time: change.start + parseTime(change.duration || 0),
        volume: change.volume,
      },
    );
  }

  return keyframes;
}

/** Get the volume at a given absolute time. */
export function getVolume(keyframes: VolumeKeyframe[], time: number): number {
  let prev = keyframes[0];

  for (const keyframe of keyframes) {
    if (keyframe.time > time) {
      // The initial keyframe is at -Infinity, so it's held
      if (prev.time === -Infinity) return prev.volume;
      const progress = (time - prev.time) / (keyframe.time - prev.time);
      return prev.volume + (keyframe.volume - prev.volume) * progress;
    }
    prev = keyframe;
  }

  return prev.volume;
}
