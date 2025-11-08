import type { FunctionComponent, Ref } from 'preact';
import { type DeepSignal } from 'deepsignal';
import { Signal } from '@preact/signals';
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
import useOptimComputed from '../../../../utils/useOptimComputed';
import { getFile } from '../../../../utils/file';
import styles from './styles.module.css';
import { shallowEqual } from '../../../../utils/shallowEqual';

const theme = 'one-dark-pro';

// TODO: optimise highlighter
const syntaxHighlighterP = createHighlighter({
  langs: ['javascript', 'html', 'xml', 'css'],
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

  const activeTimelineItems = useOptimComputed(() => {
    if (!config.timeline) return [];
    return config.timeline.filter(
      (item) => time.value >= parseTime(item.start)
    );
  });
  const currentPrevCodeItems = useOptimComputed(() => {
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
  const currentFileSource = useOptimComputed(
    () => currentPrevCodeItems.value[0].source || config.source
  );
  const prevFileSource = useOptimComputed(() =>
    currentPrevCodeItems.value[1]
      ? currentPrevCodeItems.value[1].source || config.source
      : null
  );

  const currentFileTextPromise = useOptimComputed(async () => {
    if (!currentFileSource.value) return '';
    const file = await getFile(projectDir, currentFileSource.value);
    return file.text();
  });

  const prevFileTextPromise = useOptimComputed(async () => {
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
          text.indexOf(currentCodeItem.slice.startAfter) +
          currentCodeItem.slice.startAfter.length;

        const endIndex = text.indexOf(
          currentCodeItem.slice.endBefore,
          startIndex
        );

        text = text.slice(startIndex, endIndex);
      }

      if (prevCodeItem && prevCodeItem.slice) {
        const startIndex =
          prevText!.indexOf(prevCodeItem.slice.startAfter) +
          prevCodeItem.slice.startAfter.length;

        const endIndex = prevText!.indexOf(
          prevCodeItem.slice.endBefore,
          startIndex
        );

        prevText = prevText!.slice(startIndex, endIndex);
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
        containerRef.current!.innerHTML = syntaxHighlighter.codeToHtml(text, {
          lang: getLang(currentLang, currentFile),
          theme: 'one-dark-pro',
        });
        return;
      }

      const diff =
        currentCodeItem.animMode === 'lines'
          ? diffLines(prevText, text)
          : diffChars(prevText, text);

      containerRef.current!.innerHTML = syntaxHighlighter.codeToHtml(prevText, {
        lang: getLang(currentLang, currentFile),
        theme,
      });

      const oldContent = containerRef.current!.firstElementChild!;

      // Only if any of (prevText, text, animMode, start, lang) are different from last time:
      //   Wrap and extract the lines / spans that are to be removed
      //   Perform syntax highlighting of text
      //   Wrap the lines / spans that are to be added
      //   Insert the old content into the new content in the correct places
      //   Create animations
      //   Cancel old animations (using set)
      //   Store new animations in set (actually just a ref?? Only one set of anims at a time) associated with currentCodeItem
      // Then:
      //   Get animations from set
      //   Update position of animations (may need fill-backwards)

      containerRef.current!.innerHTML = syntaxHighlighter.codeToHtml(text, {
        lang: getLang(currentLang, currentFile),
        theme,
      });

      const currentStartNum = parseTime(currentStart);

      if (animMode === 'lines') {
        const lines = containerRef.current!.querySelectorAll('.line');
        const oldLines = oldContent.querySelectorAll('.line');

        let lineDiff = 0;
        let oldLineDiff = 0;

        for (const diffEntry of diff) {
          if (diffEntry.removed === true) {
            const wrapper = document.createElement('div');
            wrapper.style.overflow = 'clip';

            if (lines[lineDiff]) {
              lines[lineDiff].before(wrapper);
            } else {
              containerRef
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
                duration: 250,
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

    waitUntil(p);

    return () => {
      aborted = true;
    };
  });

  useSignalLayoutEffect(() => {
    const start = parseTime(currentPrevCodeItems.value[0].start);

    for (const anim of currentAnimations.current) {
      anim.currentTime = time.value - start;
    }
  });

  console.log('code render');

  return <div class={styles.container} ref={containerRef} />;
};

export default Code;
