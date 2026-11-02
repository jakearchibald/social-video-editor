import type { AudioTimelineItem } from '../../../../utils/AudioTimeline';
import type { Audio } from '../../../../../project-schema/timeline-items/audio';
import { getDuration, getStartTime } from '../../../../utils/timeline-item';
import {
  clipTimeSegments,
  getTimeSegments,
} from '../../../../utils/time-segments';

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

  return clipTimeSegments(segments, start, start + duration).map(
    (segment) => ({
      start: segment.start,
      audioStart: segment.mediaStart,
      duration: segment.duration,
      playbackRate: segment.playbackRate,
      source: item.source,
      volume: item.volume,
    }),
  );
}
