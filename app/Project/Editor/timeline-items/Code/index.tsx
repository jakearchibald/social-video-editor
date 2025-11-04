import type { FunctionComponent } from 'preact';
import { type DeepSignal } from 'deepsignal';
import { Signal, useComputed, useSignal } from '@preact/signals';
import { useRef } from 'preact/hooks';
import { createHighlighter } from 'shiki';

import type { Code as CodeConfig } from '../../../../../project-schema/timeline-items/code';
import useSignalLayoutEffect from '../../../../utils/useSignalLayoutEffect';
import { waitUntil } from '../../../../utils/waitUntil';
import { parseTime } from '../../../../utils/time';
import useOptimComputed from '../../../../utils/useOptimComputed';
import { getFile } from '../../../../utils/file';

// TODO: optimise highlighter
const highlighterP = createHighlighter({
  langs: ['javascript', 'html', 'xml', 'css'],
  themes: ['one-dark-pro'],
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
      },
      ...activeTimelineItems.value.filter((item) => item.type === 'update'),
    ]
      .slice(-2)
      .reverse();
  });
  const currentFileSource = useOptimComputed(
    () => currentPrevCodeItems.value[0].source || config.source
  );
  const nextFileSource = useOptimComputed(
    () => currentPrevCodeItems.value[1]?.source || config.source
  );

  const currentFileTextPromise = useOptimComputed(async () => {
    if (!currentFileSource.value) return '';
    const file = await getFile(projectDir, currentFileSource.value);
    return file.text();
  });

  const nextFileTextPromise = useOptimComputed(async () => {
    if (!nextFileSource.value) return null;
    const file = await getFile(projectDir, nextFileSource.value);
    return file.text();
  });

  useSignalLayoutEffect(() => {
    let aborted = false;

    const currentCodeItem = currentPrevCodeItems.value[0];
    const currentTextPromise = currentFileTextPromise.value;
    const currentFile = currentFileSource.value;
    const currentLang = currentCodeItem.lang || config.lang;

    const p = (async () => {
      let text = await currentTextPromise;
      const highlighter = await highlighterP;
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

      containerRef.current!.innerHTML = highlighter.codeToHtml(text, {
        lang: getLang(currentLang, currentFile),
        theme: 'one-dark-pro',
      });
    })();

    waitUntil(p);

    return () => {
      aborted = true;
    };
  });

  // TODO:
  // Go through the timeline
  // Figure out the previous and next code
  // Figure out if the previous code is needed (for anim)
  // Can peek at currentCode and incomingCode to see if we've already got it
  // But first, assume no animations
  console.log('code render');

  return <div ref={containerRef} />;
};

export default Code;
