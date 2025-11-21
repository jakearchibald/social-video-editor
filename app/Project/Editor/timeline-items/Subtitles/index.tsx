import type { FunctionComponent } from 'preact';
import { type DeepSignal } from 'deepsignal';
import { Signal, useSignal } from '@preact/signals';
import useOptimComputed from '../../../../utils/useOptimComputed';
import { parseTime } from '../../../../utils/time';
import { useSignalRef } from '@preact/signals/utils';
import useSignalLayoutEffect from '../../../../utils/useSignalLayoutEffect';
import type { Subtitles as SubtitlesConfig } from '../../../../../project-schema/timeline-items/subtitles';
import type { SubtitlesData } from './subtitles-type';
import { waitUntil } from '../../../../utils/waitUntil';
import { getFile } from '../../../../utils/file';
import styles from './styles.module.css';

const segmentIds = new WeakMap<any, string>();
const minWordDisplayTime = 50;

interface Props {
  time: Signal<number>;
  projectDir: FileSystemDirectoryHandle;
  config: DeepSignal<SubtitlesConfig>;
}

type ResolvedWord = { start: number; end: number; text: string };

type ResolvedSubtitleItem = string | ResolvedWord;

interface ResolvedSubtitleSegment {
  start: number;
  end: number;
  items: ResolvedSubtitleItem[];
}

const Subtitles: FunctionComponent<Props> = ({ config, time, projectDir }) => {
  const subtitlesData = useSignal<SubtitlesData | null>(null);
  const containerEl = useSignalRef<HTMLDivElement | null>(null);
  const activeWordEl = useSignalRef<HTMLSpanElement | null>(null);

  const resolvedSubtitles = useOptimComputed(() => {
    if (!subtitlesData.value) return null;

    const timeShift =
      -parseTime(config.subtitlesStart) + parseTime(config.start);

    const items: ResolvedSubtitleItem[] = [];

    let text = subtitlesData.value.text;
    let lastWord: null | ResolvedWord = null;

    for (const word of subtitlesData.value.words) {
      const index = text.indexOf(word.word);
      if (index === -1) break;
      const before = text.slice(0, index);
      const after = text.slice(index + word.word.length);

      if (before) items.push(before);

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

      text = after;
      lastWord = newWord;
    }

    items.push(text);
    return items;
  });

  const resolvedSegments = useOptimComputed(() => {
    if (!resolvedSubtitles.value) return null;

    const segments: ResolvedSubtitleSegment[] = [];
    let segment!: ResolvedSubtitleSegment;
    let charsInSegment!: number;

    const newSegment = () => {
      segment = { items: [], start: -1, end: -1 };
      charsInSegment = 0;
      segments.push(segment);
      segmentIds.set(segment, String(Math.random()));
    };

    newSegment();

    let lastWord: ResolvedWord | null = null;

    for (const item of resolvedSubtitles.value) {
      if (typeof item === 'string') {
        segment.items.push(item);
        charsInSegment += item.length;
        continue;
      }

      // if (item.text === 'renders' && lastWord && lastWord.text === 'server') {
      //   debugger;
      // }

      if (
        charsInSegment >= config.segmentCharLength.min &&
        lastWord &&
        item.start - lastWord.end > 200
      ) {
        newSegment();
      }

      if (charsInSegment + item.text.length > config.segmentCharLength.max) {
        newSegment();
      }

      segment.items.push(item);
      charsInSegment += item.text.length;

      segment.end = item.end;

      if (segment.start === -1) {
        segment.start = item.start;
      }

      lastWord = item;
    }

    return segments;
  });

  const subtitlesSegment = useOptimComputed(() => {
    if (resolvedSegments.value === null) return null;

    const now = time.value;

    // TODO: optimise with binary tree - some of the offsetting may make this hard
    for (const [i, segment] of resolvedSegments.value.entries()) {
      // Allow segment to appear 500ms ahead of time
      if (segment.start - 500 > now) return null;
      if (segment.end < now) {
        const nextSegment = resolvedSegments.value[i + 1];

        // If it isn't time to show the next segment (or there isn't one)
        // Let the current segment hang around for an extra bit
        if (
          (nextSegment && nextSegment.start < now) ||
          segment.end + 500 < now
        ) {
          continue;
        }
      }
      return segment;
    }

    return null;
  });

  const activeWord = useOptimComputed(() => {
    if (!subtitlesSegment.value) return null;

    for (const [i, item] of subtitlesSegment.value.items.entries()) {
      if (typeof item === 'string') continue;
      if (item.start >= time.value) return null;

      if (item.end < time.value) {
        const nextWord = subtitlesSegment.value.items
          .slice(i + 1)
          .find((item) => typeof item !== 'string');

        // Allow word to hang around for 0.5s unless there's a pending other word
        if (
          (nextWord &&
            !(typeof nextWord === 'string') &&
            nextWord.start <= time.value) ||
          item.end + 500 < time.value
        ) {
          continue;
        }
      }
      return item;
    }

    return null;
  });

  const activeWordStyles = useOptimComputed<string>(() => {
    if (!activeWord.value || !activeWordEl.value || !containerEl.value) {
      return 'opacity: 0';
    }
    const containerBounds = containerEl.value.getBoundingClientRect();
    const bounds = activeWordEl.value.getClientRects()[0];

    if (!containerBounds || !bounds) {
      return 'opacity: 0';
    }

    return `
      top: ${bounds.top - containerBounds.top}px;
      left: ${bounds.left - containerBounds.left}px;
      width: ${bounds.width}px;
      height: ${bounds.height}px;
    `;
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
      <div class={styles.activeWordHighlight} style={activeWordStyles} />
      <div
        class={styles.segment}
        key={
          subtitlesSegment.value ? segmentIds.get(subtitlesSegment.value) : ''
        }
      >
        {subtitlesSegment.value?.items.map((item) => (
          <span ref={item === activeWord.value ? activeWordEl : undefined}>
            {typeof item === 'string' ? item : item.text}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Subtitles;
