/**
 * Wrap a media time into a loop. Times before the loop end are unchanged, so media before the loop
 * start plays once.
 */
export function wrapLoopTime(time: number, start: number, end: number): number {
  if (end <= start || time < end) return time;
  return start + ((time - start) % (end - start));
}
