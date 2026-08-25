import type { AudioTimelineItem } from '../../../../utils/AudioTimeline';
import type { Audio } from '../../../../../project-schema/timeline-items/audio';
import { getDuration, getStartTime } from '../../../../utils/timeline-item';

export function getAudioTimelineItems(
  item: Audio,
  parentStart: number,
  parentEnd: number,
): AudioTimelineItem[] {
  if (item.disabled) return [];
  if (!item.source) return [];

  return [
    {
      start: getStartTime(item, parentStart),
      audioStart: 0,
      duration: getDuration(item, parentStart, parentEnd),
      source: item.source,
      volume: item.volume,
    },
  ];
}
