import type { FunctionComponent } from 'preact';
import { type DeepSignal } from 'deepsignal';
import { Signal, effect, useComputed } from '@preact/signals';
import { useRef } from 'preact/hooks';
import type { Demo as DemoConfig } from '../../../../../project-schema/timeline-items/demo';
import useSignalLayoutEffect from '../../../../utils/useSignalLayoutEffect';
import { waitUntil } from '../../../../utils/waitUntil';
import { getFile } from '../../../../utils/file';
import styles from './styles.module.css';
import { parseTime } from '../../../../utils/time';

interface IframeMessage {
  start: number;
  data: any;
}

interface IframeAPI {
  socialVid: {
    messages: Signal<IframeMessage[]>;
    time: Signal<number>;
    effect: typeof effect;
    waitUntil: typeof waitUntil;
  };
}

interface Props {
  time: Signal<number>;
  projectDir: FileSystemDirectoryHandle;
  config: DeepSignal<DemoConfig>;
}

const Demo: FunctionComponent<Props> = ({ config, time, projectDir }) => {
  const iframeContainer = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeMessages = useComputed(() => {
    if (!config.timeline) return [];
    return config.timeline
      .filter(
        (item) => item.type === 'message' && time.value >= parseTime(item.start)
      )
      .map((item) => {
        return {
          start: parseTime(item.start),
          data: item.data,
        };
      });
  });

  useSignalLayoutEffect(() => {
    const scriptSrc = config.scriptSource;
    const styleSrc = config.styleSource;

    iframeContainer.current!.innerHTML = '';

    const iframe = document.createElement('iframe');
    iframeRef.current = iframe;
    iframe.className = styles.iframe;

    const iframeLoad = new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
    });
    iframeContainer.current!.append(iframe);

    let aborted = false;

    const p = (async () => {
      const [script, style] = await Promise.all([
        scriptSrc && getFile(projectDir, scriptSrc).then((file) => file.text()),
        styleSrc && getFile(projectDir, styleSrc).then((file) => file.text()),
      ]);

      await iframeLoad;

      if (aborted) return;

      const iframeWin = iframe.contentWindow! as typeof window & IframeAPI;
      const iframeDoc = iframe.contentDocument!;
      iframeWin.socialVid = {
        messages: iframeMessages,
        time,
        effect,
        waitUntil,
      };

      if (style) {
        const styleEl = iframeDoc.createElement('style');
        styleEl.textContent = style;
        iframeDoc.head.append(styleEl);
      }

      if (script) {
        const scriptEl = iframeDoc.createElement('script');
        scriptEl.textContent = script;
        iframeDoc.head.append(scriptEl);
      }
    })();

    waitUntil(p);

    return () => {
      aborted = true;
    };
  });

  console.log('demo render');

  return <div class={styles.container} ref={iframeContainer} />;
};

export default Demo;
