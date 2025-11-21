import type { FunctionComponent, ComponentChild } from 'preact';
import { type DeepSignal, type RevertDeepSignal } from 'deepsignal';
import { Signal, useSignal } from '@preact/signals';
import type { Container as ContainerConfig } from '../../../../../project-schema/timeline-items/container';
import TimelineChildren from '../../TimelineChildren';
import useOptimComputed from '../../../../utils/useOptimComputed';
import { parseTime } from '../../../../utils/time';
import { useEffect, useRef } from 'preact/hooks';
import { useSignalRef } from '@preact/signals/utils';
import useSignalLayoutEffect from '../../../../utils/useSignalLayoutEffect';
import { getDuration } from '../../../../utils/timeline-item';
import type { Subtitles as SubtitlesConfig } from '../../../../../project-schema/timeline-items/subtitles';
import type { SubtitlesData, SubtitleWord } from './subtitles-type';
import { waitUntil } from '../../../../utils/waitUntil';
import { getFile } from '../../../../utils/file';
import styles from './styles.module.css';
import { classes } from '../../../../utils/classes';

interface Props {
  time: Signal<number>;
  projectDir: FileSystemDirectoryHandle;
  config: DeepSignal<SubtitlesConfig>;
}

type ResolvedWord = { start: number; end: number; text: string };

type ResolvedSubtitleItem = string | ResolvedWord;

const Subtitles: FunctionComponent<Props> = ({ config, time, projectDir }) => {
  const subtitlesData = useSignal<SubtitlesData | null>(null);
  const containerEl = useSignalRef<HTMLDivElement | null>(null);
  const activeWordEl = useSignalRef<HTMLSpanElement | null>(null);

  const subtitlesSegment = useOptimComputed(() => {
    if (subtitlesData.value === null) return null;

    const offsetSeconds =
      (time.value -
        parseTime(config.start) +
        parseTime(config.subtitlesStart)) /
      1000;

    // TODO: optimise with binary tree
    for (const [i, segment] of subtitlesData.value.segments.entries()) {
      // Allow segment to appear 200ms ahead of time
      if (segment.start - 0.2 > offsetSeconds) return null;
      if (segment.end < offsetSeconds) {
        const nextSegment = subtitlesData.value.segments[i + 1];

        // If it isn't time to show the next segment (or there isn't one)
        // Let the current segment hang around for an extra bit
        if (
          (nextSegment && nextSegment.start < offsetSeconds) ||
          segment.end + 0.5 < offsetSeconds
        ) {
          continue;
        }
      }
      return segment;
    }

    return null;
  });

  const segmentWords = useOptimComputed(() => {
    const segment = subtitlesSegment.value;
    if (!segment || !subtitlesData.value) return null;

    const words: SubtitleWord[] = [];

    // TODO: optimise with binary tree
    for (const word of subtitlesData.value.words) {
      if (word.start >= segment.end) return words;
      if (word.start < segment.start) continue;
      words.push(word);
    }
    return words;
  });

  const resolvedSegment = useOptimComputed(() => {
    if (!subtitlesSegment.value || !segmentWords.value) return;

    const timeShift =
      -parseTime(config.subtitlesStart) + parseTime(config.start);

    const items: ResolvedSubtitleItem[] = [];

    let text = subtitlesSegment.value.text;

    for (const word of segmentWords.value) {
      const index = text.indexOf(word.word);
      if (index === -1) break;
      const before = text.slice(0, index);
      const after = text.slice(index + word.word.length);

      if (before) items.push(before);

      items.push({
        text: word.word,
        start: word.start * 1000 + timeShift,
        end: word.end * 1000 + timeShift,
      });

      text = after;
    }

    items.push(text);
    return items;
  });

  const activeWord = useOptimComputed(() => {
    if (!resolvedSegment.value) return null;

    for (const item of resolvedSegment.value) {
      if (typeof item === 'string') continue;
      if (item.start >= time.value) return null;
      if (item.end < time.value) continue;
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
        key={subtitlesSegment.value ? subtitlesSegment.value.text : ''}
      >
        {resolvedSegment.value?.map((item) => (
          <span ref={item === activeWord.value ? activeWordEl : undefined}>
            {typeof item === 'string' ? item : item.text}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Subtitles;
