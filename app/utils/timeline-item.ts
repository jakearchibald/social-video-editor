import type { ChildrenTimelineItemBase } from '../../project-schema/schema';
import { parseTime } from './time';

export function getDuration(config: ChildrenTimelineItemBase) {
  if (config.duration !== undefined) {
    return parseTime(config.duration);
  }

  return parseTime(config.end) - parseTime(config.start);
}

export function getEndTime(config: ChildrenTimelineItemBase) {
  if (config.end !== undefined) {
    return parseTime(config.end);
  }

  return parseTime(config.start) + parseTime(config.duration);
}
