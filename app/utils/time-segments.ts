import { parseTime } from './time';

export interface TimeChange {
  /** Absolute start time. 00:00:00.000 or ms */
  start: string | number;
  playbackRate?: number;
  /** New time within the media file. 00:00:00.000 or ms */
  mediaTime?: string | number;
}

export interface TimeSegment {
  /** Absolute start time of the segment, in ms */
  start: number;
  /** Time within the media file at the start of the segment, in ms */
  mediaStart: number;
  playbackRate: number;
}

/**
 * Get the segments of constant playback rate for a piece of media. Each segment runs until the
 * start of the next. The last segment runs indefinitely.
 */
export function getTimeSegments(
  start: number,
  mediaStart: number,
  playbackRate: number,
  timeChanges: TimeChange[] = [],
): TimeSegment[] {
  const sortedChanges = timeChanges
    .map((change) => ({ ...change, start: parseTime(change.start) }))
    .sort((a, b) => a.start - b.start);

  const segments: TimeSegment[] = [{ start, mediaStart, playbackRate }];

  for (const change of sortedChanges) {
    const prev = segments.at(-1)!;
    segments.push({
      start: change.start,
      mediaStart:
        change.mediaTime === undefined
          ? prev.mediaStart + (change.start - prev.start) * prev.playbackRate
          : parseTime(change.mediaTime),
      playbackRate: change.playbackRate ?? prev.playbackRate,
    });
  }

  return segments;
}

/** Get the time within the media file for a given absolute time. */
export function getMediaTime(segments: TimeSegment[], time: number): number {
  let segment = segments[0];

  for (const candidate of segments) {
    if (candidate.start > time) break;
    segment = candidate;
  }

  return segment.mediaStart + (time - segment.start) * segment.playbackRate;
}

/** Clip segments to an absolute time range, giving each a duration. */
export function clipTimeSegments(
  segments: TimeSegment[],
  start: number,
  end: number,
): (TimeSegment & { duration: number })[] {
  const clipped: (TimeSegment & { duration: number })[] = [];

  for (const [i, segment] of segments.entries()) {
    const segmentStart = Math.max(segment.start, start);
    const segmentEnd = Math.min(segments[i + 1]?.start ?? Infinity, end);
    if (segmentEnd <= segmentStart) continue;

    clipped.push({
      start: segmentStart,
      duration: segmentEnd - segmentStart,
      mediaStart:
        segment.mediaStart +
        (segmentStart - segment.start) * segment.playbackRate,
      playbackRate: segment.playbackRate,
    });
  }

  return clipped;
}
