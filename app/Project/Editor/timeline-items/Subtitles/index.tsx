import type { FunctionComponent } from 'preact';
import { type DeepSignal } from 'deepsignal';
import { Signal, useSignal, useComputed } from '@preact/signals';
import { parseTime } from '../../../../utils/time';
import { useSignalRef } from '@preact/signals/utils';
import useSignalLayoutEffect from '../../../../utils/useSignalLayoutEffect';
import type { Subtitles as SubtitlesConfig } from '../../../../../project-schema/timeline-items/subtitles';
import type { SubtitlesData } from './subtitles-type';
import { waitUntil } from '../../../../utils/waitUntil';
import { getFile } from '../../../../utils/file';
import styles from './styles.module.css';
import { getStartTime } from '../../../../utils/timeline-item';

const segmentKeys = new WeakMap<any, string>();
const minWordDisplayTime = 50;
// Gaps between subtitles shorter than this look like a flash, so the previous
// subtitle is left on screen to fill them.
const minSubtitleGap = 1000;

interface Props {
  time: Signal<number>;
  projectDir: FileSystemDirectoryHandle;
  config: DeepSignal<SubtitlesConfig>;
  parentStart: number;
}

type ResolvedWord = { start: number; end: number; text: string };

type ResolvedSubtitleItem = string | ResolvedWord;

class ResolvedSubtitleSegment {
  items: ResolvedSubtitleItem[] = [];
  /**
   * The time this segment leaves the screen. This may be later than `end`, to
   * avoid a brief gap before the next segment appears.
   */
  displayEnd = -1;

  constructor() {
    segmentKeys.set(this, String(Math.random()));
  }

  get start() {
    const firstWord = this.items.find((item) => typeof item !== 'string');
    return firstWord ? firstWord.start : -1;
  }

  get end() {
    const lastWord = this.items.findLast((item) => typeof item !== 'string');
    return lastWord ? lastWord.end : -1;
  }
}

const Subtitles: FunctionComponent<Props> = ({
  config,
  time,
  projectDir,
  parentStart,
}) => {
  const subtitlesData = useSignal<SubtitlesData | null>(null);
  const containerEl = useSignalRef<HTMLDivElement | null>(null);

  const resolvedSubtitles = useComputed(() => {
    if (!subtitlesData.value) return null;

    const timeShift =
      -parseTime(config.subtitlesStart) + getStartTime(config, parentStart);

    const items: ResolvedSubtitleItem[] = [];

    let lastWord: null | ResolvedWord = null;

    for (const word of subtitlesData.value.word_segments) {
      if (lastWord) items.push(' ');

      const newWord: ResolvedWord = {
        text: word.word,
        start: word.start * 1000 + timeShift,
        end: word.end * 1000 + timeShift,
      };

      if (lastWord && newWord.start < lastWord.end) {
        newWord.start = lastWord.end;
      }

      if (newWord.end - newWord.start < minWordDisplayTime) {
        newWord.end = newWord.start + minWordDisplayTime;
      }

      items.push(newWord);

      lastWord = newWord;
    }

    return items;
  });

  const resolvedSegments = useComputed(() => {
    if (!resolvedSubtitles.value) return null;

    const segments: ResolvedSubtitleSegment[] = [];

    let remainingWords = resolvedSubtitles.value.slice();

    // Split by sentences
    while (true) {
      const sentenceEndIndex = remainingWords.findIndex((item) => {
        if (typeof item === 'string') return false;
        return /[?!.]$/.test(item.text);
      });

      if (sentenceEndIndex === -1) {
        const segment = new ResolvedSubtitleSegment();
        segment.items = remainingWords;
        segments.push(segment);
        break;
      }

      const segment = new ResolvedSubtitleSegment();
      segment.items = remainingWords.slice(0, sentenceEndIndex + 1);
      segments.push(segment);

      remainingWords = remainingWords.slice(sentenceEndIndex + 1);

      if (remainingWords.length === 0) break;
    }

    // Split segments
    for (let i = 0; i < segments.length; ) {
      const segment = segments[i];
      const text = segment.items
        .map((item) => (typeof item === 'string' ? item : item.text))
        .join('');

      if (text.length <= config.segmentCharLength.max) {
        i++;
        continue;
      }

      // Find the biggest gap between words to split at
      let biggestGapIndex = -1;
      let biggestGapDuration = 0;
      let charsProcessed = 0;

      for (const [i, item] of segment.items.entries()) {
        const itemText = typeof item === 'string' ? item : item.text;
        charsProcessed += itemText.length;

        if (typeof item === 'string') continue;

        const nextWord = segment.items
          .slice(i + 1)
          .find((item) => typeof item !== 'string');

        if (!nextWord) continue;

        const beforeLength = charsProcessed;
        const afterLength = text.length - charsProcessed;

        // Skip if either segment would be below the minimum length
        if (
          beforeLength < config.segmentCharLength.min ||
          afterLength < config.segmentCharLength.min
        ) {
          continue;
        }

        const gapDuration = nextWord.start - item.end;

        if (gapDuration > biggestGapDuration) {
          biggestGapDuration = gapDuration;
          biggestGapIndex = i;
        }
      }

      if (biggestGapIndex === -1) {
        i++;
        continue;
      }

      const newSegment = new ResolvedSubtitleSegment();
      newSegment.items = segment.items.slice(biggestGapIndex + 1);
      segment.items = segment.items.slice(0, biggestGapIndex + 1);

      segments.splice(i + 1, 0, newSegment);
    }

    // Extend each segment's on-screen time to fill short gaps before the next
    // segment, otherwise the transition looks like a flash.
    for (const [i, segment] of segments.entries()) {
      const nextSegment = segments[i + 1];

      if (!nextSegment) {
        segment.displayEnd = segment.end + minSubtitleGap;
        continue;
      }

      const gap = nextSegment.start - segment.end;

      segment.displayEnd =
        gap < minSubtitleGap ? nextSegment.start : segment.end + minSubtitleGap;
    }

    return segments;
  });

  const subtitlesSegment = useComputed(() => {
    if (resolvedSegments.value === null) return null;

    const now = time.value;

    // TODO: optimise with binary tree - some of the offsetting may make this hard
    for (const segment of resolvedSegments.value) {
      // Allow segment to appear 500ms ahead of time
      if (segment.start - minSubtitleGap > now) return null;
      // The segment hangs around until its display end, which covers short gaps
      // before the next segment.
      if (segment.displayEnd < now) continue;
      return segment;
    }

    return null;
  });

  const activeWords = useComputed(() => {
    if (!subtitlesSegment.value) return null;

    const firstFutureIndex = subtitlesSegment.value.items.findIndex((item) => {
      if (typeof item === 'string') return false;
      return item.start > time.value;
    });

    const activeWords: Set<ResolvedSubtitleItem> = new Set(
      subtitlesSegment.value.items.slice(
        0,
        firstFutureIndex === -1 ? undefined : firstFutureIndex,
      ),
    );

    return activeWords;
  });

  useSignalLayoutEffect(() => {
    const source = config.source;

    const p = (async () => {
      const file = await getFile(projectDir, source);
      subtitlesData.value = JSON.parse(await file.text());
    })();

    waitUntil(p);
  });

  return (
    <div class={styles.container} ref={containerEl}>
      <div
        class={styles.segment}
        key={
          subtitlesSegment.value ? segmentKeys.get(subtitlesSegment.value) : ''
        }
      >
        {subtitlesSegment.value?.items.map((item) => (
          <span
            style={{
              color:
                activeWords.value && activeWords.value.has(item)
                  ? '#fff'
                  : '#c9c9c9',
            }}
          >
            {typeof item === 'string' ? item : item.text}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Subtitles;
