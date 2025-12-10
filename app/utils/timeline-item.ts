import type { ChildrenTimelineItemBase } from '../../project-schema/schema';
import { parseTime } from './time';

export function getStartTime(
  config: ChildrenTimelineItemBase,
  parentStart: number = 0
): number {
  if (config.start !== undefined) {
    return parseTime(config.start);
  }
  return parentStart;
}

export function getDuration(
  config: ChildrenTimelineItemBase,
  parentStart: number = 0,
  parentEnd?: number
): number {
  if (config.duration !== undefined) {
    return parseTime(config.duration);
  }

  const start = getStartTime(config, parentStart);

  if (config.end !== undefined) {
    return parseTime(config.end) - start;
  }

  if (parentEnd !== undefined) {
    return parentEnd - start;
  }

  throw new Error('Cannot calculate duration: no end time or parent end time provided');
}

export function getEndTime(
  config: ChildrenTimelineItemBase,
  parentStart: number = 0,
  parentEnd?: number
): number {
  if (config.end !== undefined) {
    return parseTime(config.end);
  }

  const start = getStartTime(config, parentStart);

  if (config.duration !== undefined) {
    return start + parseTime(config.duration);
  }

  if (parentEnd !== undefined) {
    return parentEnd;
  }

  throw new Error('Cannot calculate end time: no end time, duration, or parent end time provided');
}
