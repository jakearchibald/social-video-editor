import type {
  AudioLoop,
  AudioTimelineItem,
} from '../../../../utils/AudioTimeline';
import type { Audio } from '../../../../../project-schema/timeline-items/audio';
import { getDuration, getStartTime } from '../../../../utils/timeline-item';
import { parseTime } from '../../../../utils/time';
import {
  clipTimeSegments,
  getTimeSegments,
} from '../../../../utils/time-segments';
import { getVolumeKeyframes } from '../../../../utils/volume-keyframes';

export function getAudioTimelineItems(
  item: Audio,
  parentStart: number,
  parentEnd: number,
): AudioTimelineItem[] {
  if (item.disabled) return [];
  if (!item.source) return [];

  const start = getStartTime(item, parentStart);
  const duration = getDuration(item, parentStart, parentEnd);
  const segments = getTimeSegments(
    start,
    0,
    item.playbackRate ?? 1,
    item.timeline
      ?.filter((change) => change.type === 'time-change')
      .map((change) => ({
        start: change.start,
        playbackRate: change.playbackRate,
        mediaTime: change.audioTime,
      })),
  );
  const volume = getVolumeKeyframes(
    item.volume ?? 1,
    item.timeline?.filter((change) => change.type === 'volume-change'),
  );

  const loop: AudioLoop | undefined = item.loop
    ? {
        start: parseTime(item.loopStart || 0),
        end: item.loopEnd === undefined ? undefined : parseTime(item.loopEnd),
      }
    : undefined;

  return clipTimeSegments(segments, start, start + duration).map(
    (segment) => ({
      start: segment.start,
      audioStart: segment.mediaStart,
      duration: segment.duration,
      playbackRate: segment.playbackRate,
      source: item.source,
      volume,
      loop,
    }),
  );
}
