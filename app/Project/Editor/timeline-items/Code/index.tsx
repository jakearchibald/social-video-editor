import { type FunctionComponent, type Ref } from 'preact';
import { type DeepSignal } from 'deepsignal';
import { Signal, useComputed } from '@preact/signals';
import { useRef } from 'preact/hooks';
import { createHighlighter } from 'shiki';
import { diffChars, diffLines } from 'diff';

import type {
  Code as CodeConfig,
  CodeTimelineItemUpdate,
} from '../../../../../project-schema/timeline-items/code';
import useSignalLayoutEffect from '../../../../utils/useSignalLayoutEffect';
import { waitUntil } from '../../../../utils/waitUntil';
import { parseTime } from '../../../../utils/time';
import { getFile } from '../../../../utils/file';
import styles from './styles.module.css';
import { shallowEqual } from '../../../../utils/shallowEqual';
import { mulberry32 } from '../../../../utils/mulberry32';
import { useComputedShallow } from '../../../../utils/useComputedShallow';
import BaseContainer from '../../BaseContainer';
import { findText } from '../../../../utils/findText';

const theme = 'dark-plus';

// TODO: optimise highlighter
const syntaxHighlighterP = createHighlighter({
  langs: ['javascript', 'html', 'xml', 'css', 'mdx'],
  themes: [theme],
});

function getLang(lang: string | undefined, source: string | undefined): string {
  if (!source) return 'plain';
  if (lang) return lang;
  return source.split('.').slice(-1)[0];
}

interface Props {
  time: Signal<number>;
  projectDir: FileSystemDirectoryHandle;
  config: DeepSignal<CodeConfig>;
}

const Code: FunctionComponent<Props> = ({ config, time, projectDir }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const codeReady = useRef<Promise<void>>(Promise.resolve());

  const activeTimelineItems = useComputedShallow(() => {
    if (!config.timeline) return [];
    return config.timeline.filter(
      (item) =>
        time.value >= parseTime(item.start) &&
        ('end' in item ? time.value < parseTime(item.end) : true)
    );
  });

  const currentPrevCodeItems = useComputed(() => {
    return [
      {
        type: 'update',
        source: config.source,
        lang: config.lang,
        slice: config.slice,
        start: config.start,
      },
      ...activeTimelineItems.value.filter((item) => item.type === 'update'),
    ]
      .slice(-2)
      .reverse() as [
      CodeTimelineItemUpdate,
      CodeTimelineItemUpdate | undefined
    ];
  });

  const currentFileSource = useComputed(
    () => currentPrevCodeItems.value[0].source || config.source
  );
  const prevFileSource = useComputed(() =>
    currentPrevCodeItems.value[1]
      ? currentPrevCodeItems.value[1].source || config.source
      : null
  );

  const currentFileTextPromise = useComputed(async () => {
    if (!currentFileSource.value) return '';
    const file = await getFile(projectDir, currentFileSource.value);
    return file.text();
  });

  const prevFileTextPromise = useComputed(async () => {
    if (!prevFileSource.value) return null;
    const file = await getFile(projectDir, prevFileSource.value);
    return file.text();
  });

  const currentAnimations = useRef<Animation[]>([]);

  const previousChangeData: Ref<{
    prevText: string | null;
    text: string;
    animMode: CodeTimelineItemUpdate['animMode'];
    start: number | string;
    lang: string | undefined;
  } | null> = useRef(null);

  useSignalLayoutEffect(() => {
    let aborted = false;

    const currentCodeItem = currentPrevCodeItems.value[0];
    const prevCodeItem = currentPrevCodeItems.value[1];
    const currentTextPromise = currentFileTextPromise.value;
    const prevTextPromise = prevFileTextPromise.value;
    const currentFile = currentFileSource.value;
    const currentLang = currentCodeItem.lang || config.lang;
    const currentStart = currentCodeItem.start;
    const animMode = currentCodeItem.animMode;

    const p = (async () => {
      let text = await currentTextPromise;
      let prevText = await prevTextPromise;

      const syntaxHighlighter = await syntaxHighlighterP;
      if (aborted) return;

      if (currentCodeItem.slice) {
        const startIndex =
          currentCodeItem.slice.startAfter !== undefined
            ? text.indexOf(currentCodeItem.slice.startAfter) +
              currentCodeItem.slice.startAfter.length
            : 0;

        const endIndex =
          currentCodeItem.slice.endBefore !== undefined
            ? text.indexOf(currentCodeItem.slice.endBefore, startIndex)
            : text.length;

        text = text.slice(startIndex, endIndex);
      }

      if (prevCodeItem && prevCodeItem.slice) {
        const startIndex =
          prevCodeItem.slice.startAfter !== undefined
            ? prevText!.indexOf(prevCodeItem.slice.startAfter) +
              prevCodeItem.slice.startAfter.length
            : 0;

        const endIndex =
          prevCodeItem.slice.endBefore !== undefined
            ? prevText!.indexOf(prevCodeItem.slice.endBefore, startIndex)
            : prevText!.length;

        prevText = prevText!.slice(startIndex, endIndex);
      }

      // Remove lines that contain only "prettier-ignore" lines when trimmed
      const ignoredLines = new Set([
        '// prettier-ignore',
        '<!-- prettier-ignore -->',
        '/* prettier-ignore */',
      ]);

      text = text
        .split('\n')
        .filter((line) => !ignoredLines.has(line.trim()))
        .join('\n');

      if (prevText !== null) {
        prevText = prevText
          .split('\n')
          .filter((line) => !ignoredLines.has(line.trim()))
          .join('\n');
      }

      const changeData = {
        prevText,
        text,
        animMode,
        lang: currentLang,
        start: currentStart,
      };

      const prevData = previousChangeData.current;

      previousChangeData.current = changeData;

      if (shallowEqual(prevData, changeData)) return;

      for (const anim of currentAnimations.current) {
        anim.cancel();
      }

      currentAnimations.current = [];

      if (prevText === null) {
        codeContainerRef.current!.innerHTML = syntaxHighlighter.codeToHtml(
          text,
          {
            lang: getLang(currentLang, currentFile),
            theme,
          }
        );
        return;
      }

      const diff =
        currentCodeItem.animMode === 'lines'
          ? diffLines(prevText, text)
          : currentCodeItem.animMode === 'chars'
          ? diffChars(prevText, text)
          : undefined;

      codeContainerRef.current!.innerHTML = syntaxHighlighter.codeToHtml(
        prevText,
        {
          lang: getLang(currentLang, currentFile),
          theme,
        }
      );

      const oldContent = codeContainerRef.current!.firstElementChild!;

      codeContainerRef.current!.innerHTML = syntaxHighlighter.codeToHtml(text, {
        lang: getLang(currentLang, currentFile),
        theme,
      });

      const currentStartNum = parseTime(currentStart);

      if (animMode === 'chars') {
        codeContainerRef.current?.prepend(oldContent);

        let delStart = 0;
        let addStart = 0;

        for (const diffEntry of diff!) {
          if (!diffEntry.removed && !diffEntry.added) {
            delStart += diffEntry.count;
            addStart += diffEntry.count;
            continue;
          }

          if (diffEntry.added) {
            const addEnd = addStart + diffEntry.count;
            const walker = document.createTreeWalker(
              oldContent.nextElementSibling!,
              NodeFilter.SHOW_TEXT
            );
            let charIndex = 0;
            let node: Text | null;

            while ((node = walker.nextNode() as Text)) {
              if (node.data.length === 0) continue;
              if (addStart < charIndex + node.data.length) {
                const range = document.createRange();
                range.setStart(node, Math.max(0, addStart - charIndex));
                range.setEnd(node, range.startOffset + 1);
                const wrapper = document.createElement('span');
                wrapper.className = 'add-wrapper';
                range.surroundContents(wrapper);
                // Move forward one to account for the new text node we just made
                walker.nextNode();
                charIndex += node.data.length + 1;
              } else {
                charIndex += node.data.length;
              }
              if (charIndex >= addEnd) break;
            }

            addStart += diffEntry.count;
            continue;
          }

          const delEnd = delStart + diffEntry.count;
          const walker = document.createTreeWalker(
            oldContent,
            NodeFilter.SHOW_TEXT
          );
          let charIndex = 0;
          let node: Text | null;

          while ((node = walker.nextNode() as Text)) {
            if (node.data.length === 0) continue;
            if (delStart < charIndex + node.data.length) {
              const range = document.createRange();
              range.setStart(node, Math.max(0, delStart - charIndex));
              range.setEnd(node, range.startOffset + 1);
              const wrapper = document.createElement('span');
              wrapper.className = 'del-wrapper';
              range.surroundContents(wrapper);
              // Move forward one to account for the new text node we just made
              walker.nextNode();
              charIndex += node.data.length + 1;
            } else {
              charIndex += node.data.length;
            }
            if (charIndex >= delEnd) break;
          }

          delStart += diffEntry.count;
        }

        // Animate
        const delEls =
          codeContainerRef.current!.querySelectorAll('.del-wrapper');
        let delDuration = 0;

        for (const [i, el] of [...delEls].reverse().entries()) {
          delDuration = 70 * i;

          const anim = el.animate(
            [{ display: 'inline' }, { display: 'none' }],
            {
              duration: delDuration,
              easing: 'step-end',
              fill: 'forwards',
            }
          );
          anim.pause();
          anim.currentTime = time.value - currentStartNum;
          currentAnimations.current.push(anim);
        }

        const addStartAnimTime = delDuration ? delDuration + 100 : 0;

        // Make the swap
        {
          const anim = oldContent.animate(
            [{ display: 'block' }, { display: 'none' }],
            {
              duration: addStartAnimTime,
              easing: 'step-end',
              fill: 'forwards',
            }
          );
          anim.pause();
          anim.currentTime = time.value - currentStartNum;
          currentAnimations.current.push(anim);
        }
        {
          const anim = oldContent.nextElementSibling!.animate(
            [{ display: 'none' }, { display: 'block' }],
            {
              duration: addStartAnimTime,
              easing: 'step-end',
              fill: 'forwards',
            }
          );
          anim.pause();
          anim.currentTime = time.value - currentStartNum;
          currentAnimations.current.push(anim);
        }

        const addEls =
          codeContainerRef.current!.querySelectorAll('.add-wrapper');

        let typeDelay = addStartAnimTime;
        const rand = mulberry32(currentStartNum);

        for (const el of addEls) {
          typeDelay += Math.pow(rand(), 2) * 150 + 20;

          const anim = el.animate(
            [{ display: 'none' }, { display: 'inline' }],
            {
              duration: typeDelay,
              easing: 'step-end',
            }
          );
          anim.pause();
          anim.currentTime = time.value - currentStartNum;
          currentAnimations.current.push(anim);
        }
      } else if (animMode === 'lines') {
        const lines = codeContainerRef.current!.querySelectorAll('.line');
        const oldLines = oldContent.querySelectorAll('.line');

        let lineDiff = 0;
        let oldLineDiff = 0;

        for (const diffEntry of diff!) {
          if (diffEntry.removed === true) {
            const wrapper = document.createElement('div');
            wrapper.style.overflow = 'clip';

            if (lines[lineDiff]) {
              lines[lineDiff].before(wrapper);
            } else {
              codeContainerRef
                .current!.querySelector('code')!
                .append('\n', wrapper);
            }

            for (let i = 0; i < diffEntry.count; i++) {
              const line = oldLines[oldLineDiff + i];
              wrapper.append(
                line,
                // Need to include next text node, which is often a newline
                line.nextSibling || ''
              );
            }

            const anim = wrapper.animate(
              [{ height: 'auto' }, { height: '0' }],
              {
                duration: 300,
                easing: 'ease',
                fill: 'forwards',
              }
            );

            anim.pause();
            anim.currentTime = time.value - currentStartNum;
            currentAnimations.current.push(anim);
          } else if (diffEntry.added === true) {
            const wrapper = document.createElement('div');
            wrapper.style.overflow = 'clip';
            lines[lineDiff].before(wrapper);

            for (let i = 0; i < diffEntry.count; i++) {
              const line = lines[lineDiff + i];
              wrapper.append(
                line,
                // Need to include next text node, which is often a newline
                line.nextSibling || ''
              );
            }

            const anim = wrapper.animate(
              [{ height: '0' }, { height: 'auto' }],
              {
                duration: 250,
                easing: 'ease',
              }
            );

            anim.pause();
            anim.currentTime = time.value - currentStartNum;
            currentAnimations.current.push(anim);
          }

          if (diffEntry.removed === false) {
            lineDiff += diffEntry.count;
          }
          if (diffEntry.added === false) {
            oldLineDiff += diffEntry.count;
          }
        }
      }
    })();

    codeReady.current = p;

    waitUntil(p);

    return () => {
      aborted = true;
    };
  });

  useSignalLayoutEffect(() => {
    const start = parseTime(currentPrevCodeItems.value[0].start);
    const timeVal = time.value;

    for (const anim of currentAnimations.current) {
      anim.currentTime = timeVal - start;
    }
  });

  const activeHighlights = useComputedShallow(() => {
    if (!config.timeline) return [];
    return activeTimelineItems.value.filter(
      (item) => item.type === 'highlight'
    );
  });

  useSignalLayoutEffect(() => {
    const highlights = activeHighlights.value;
    if (highlights.length === 0) return;

    (async () => {
      await codeReady.current;
      const highlightEls =
        containerRef.current!.querySelectorAll<HTMLDivElement>(
          `.${styles.highlight}`
        );

      for (const [i, el] of highlightEls.entries()) {
        const highlight = highlights[i];
        const range = findText(highlight.text, {
          root: codeContainerRef.current!,
          index: highlight.index || 0,
        });

        if (!range) {
          console.error(
            `Could not find text to highlight: "${highlight.text}"`
          );
          continue;
        }

        const rect = range.getBoundingClientRect();
        const containerRect = codeContainerRef.current!.getBoundingClientRect();

        el.style.top = `${rect.top - containerRect.top}px`;
        el.style.height = `${rect.height}px`;
        el.style.left = `${rect.left - containerRect.left}px`;
        el.style.width = `${rect.width}px`;
      }
    })();
  });

  console.log('code render');

  return (
    <div class={styles.container} ref={containerRef}>
      <div class={styles.highlights}>
        {activeHighlights.value.map((highlight) => (
          <div class={styles.highlight} key={highlight.text}>
            <BaseContainer
              class={styles.highlightInner}
              time={time}
              exit={{ type: 'fade', end: parseTime(highlight.end) }}
              styles={{
                clipPath: 'inset(0 100% 0 0 round 0.2em)',
              }}
              timeline={[
                {
                  type: 'add-styles',
                  styles: { clipPath: 'inset(0 round 0.2em)' },
                  start: parseTime(highlight.start),
                  transition: { duration: 300, easing: 'ease' },
                },
              ]}
            />
          </div>
        ))}
      </div>
      <div class={styles.codeContainer} ref={codeContainerRef} />
    </div>
  );
};

export default Code;
