import type { FunctionComponent } from 'preact';
import { type Signal, useComputed } from '@preact/signals';
import styles from './styles.module.css';
import type { DeepSignal } from 'deepsignal';
import type {
  Support as SupportConfig,
  SupportTimelineItemBrowser,
} from '../../../../../project-schema/timeline-items/support';
import firefoxImg from './imgs/firefox.svg?url';
import chromeImg from './imgs/chrome.svg?url';
import safariImg from './imgs/safari.svg?url';
import useSignalLayoutEffect from '../../../../utils/useSignalLayoutEffect';
import { useSignalRef } from '@preact/signals/utils';
import { waitUntil } from '../../../../utils/waitUntil';
import { useComputedShallow } from '../../../../utils/useComputedShallow';
import { parseTime } from '../../../../utils/time';
import { classes } from '../../../../utils/classes';
import { animateFromKeyed } from '../../../../utils/animateFrom';

interface SupportItem {
  img: string;
  active: boolean;
  text: string;
  timelineItem?: SupportTimelineItemBrowser;
}

interface Props {
  time: Signal<number>;
  config: DeepSignal<SupportConfig>;
}

const Support: FunctionComponent<Props> = ({ config, time }) => {
  const containerRef = useSignalRef<HTMLDivElement | null>(null);
  const browserRefs = [
    useSignalRef<HTMLDivElement | null>(null),
    useSignalRef<HTMLDivElement | null>(null),
    useSignalRef<HTMLDivElement | null>(null),
  ];

  const activeTimelineItems = useComputedShallow(() => {
    if (!config.timeline) return [];

    return config.timeline.filter(
      (item) => time.value >= parseTime(item.start)
    );
  });

  const items = useComputed(() => {
    const firefox: SupportItem = { img: firefoxImg, active: false, text: '' };
    const chrome: SupportItem = { img: chromeImg, active: false, text: '' };
    const safari: SupportItem = { img: safariImg, active: false, text: '' };
    const all = { firefox, chrome, safari };

    for (const timelineItem of activeTimelineItems.value) {
      if (timelineItem.type !== 'browser') continue;
      const browserItem = all[timelineItem.browser];
      browserItem.active = true;
      browserItem.text = timelineItem.version;
      browserItem.timelineItem = timelineItem;
    }

    return [firefox, chrome, safari];
  });

  useSignalLayoutEffect(() => {
    for (const [i, item] of items.value.entries()) {
      const ref = browserRefs[i];
      if (!ref.value || !item.active) continue;
      animateFromKeyed(
        item.timelineItem!,
        time,
        ref.value,
        parseTime(item.timelineItem!.start),
        { scale: '0.7' },
        {
          duration: 500,
          easing: `linear(0, 0.009, 0.035 1.8%, 0.141 3.9%, 0.725 11.5%, 0.942 14.9%, 1.022, 1.082, 1.125, 1.152 21.9%, 1.16, 1.163, 1.161 25.3%, 1.153 26.7%, 1.129 29.1%, 1.05 35.3%, 1.016 38.4%, 0.989, 0.976 45.6%, 0.973 48.1%, 0.975 50.8%, 0.997 62.3%, 1.004 69%, 0.999)`,
        }
      );
    }
  });

  // Wait for images
  useSignalLayoutEffect(() => {
    if (!containerRef.value) return;
    const imgs = containerRef.value.querySelectorAll('img');
    waitUntil(
      (async () => {
        const localImgs = [...imgs].map((img) => {
          const localImg = new Image();
          localImg.src = img.src;
          return new Promise<void>((resolve, reject) => {
            localImg.onload = () => resolve();
            localImg.onerror = () => reject();
          });
        });
        await Promise.all(localImgs);
      })()
    );
  });

  return (
    <div class={styles.support} ref={containerRef}>
      {items.value.map((item, i) => (
        <div class={styles.supportItem}>
          <img src={item.img} />
          <div
            class={classes({
              [styles.supportResult]: true,
              [styles.active]: item.active,
            })}
            ref={browserRefs[i]}
          >
            {item.text}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Support;
