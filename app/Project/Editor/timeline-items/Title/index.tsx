import type { FunctionComponent } from 'preact';
import { useSignal, type Signal } from '@preact/signals';
import styles from './styles.module.css';
import type { DeepSignal } from 'deepsignal';
import type { Title } from '../../../../../project-schema/timeline-items/title';
import { useSignalRef } from '@preact/signals/utils';
import useSignalLayoutEffect from '../../../../utils/useSignalLayoutEffect';
import useOptimComputed from '../../../../utils/useOptimComputed';
import { parseTime } from '../../../../utils/time';
import { useRef } from 'preact/hooks';

interface ActiveAnimation {
  anim: Animation;
  start: number;
}

interface Props {
  time: Signal<number>;
  config: DeepSignal<Title>;
}

const Title: FunctionComponent<Props> = ({ config, time }) => {
  const activeAnimations = useRef<ActiveAnimation[]>([]);
  const bottomRef = useSignalRef<HTMLDivElement | null>(null);
  const topRef = useSignalRef<HTMLDivElement | null>(null);
  const textRef = useSignalRef<HTMLDivElement | null>(null);
  const textInnerRef = useSignalRef<HTMLDivElement | null>(null);
  const containerRef = useSignalRef<HTMLDivElement | null>(null);
  const bottomHeight = useSignal(0);
  const textHeight = useSignal(0);
  const topHeight = useSignal(0);
  const activeTimelineItems = useOptimComputed(() => {
    if (!config.timeline) return [];
    return config.timeline.filter(
      (item) => time.value >= parseTime(item.start)
    );
  });

  const state = useOptimComputed(() => {
    if (activeTimelineItems.value.length === 0) {
      return { type: 'initial', start: config.start };
    }
    return activeTimelineItems.value.at(-1)!;
  });

  const containerStyle = useOptimComputed(() => {
    return `--bottom-height: ${bottomHeight.value}px; --top-height: ${topHeight.value}px; --text-height: ${textHeight.value}px;`;
  });

  const containerClass = useOptimComputed(() => {
    return `${styles.container} ${styles[state.value.type]}`;
  });

  useSignalLayoutEffect(() => {
    if (!bottomRef.value) return;

    const observer = new ResizeObserver((entries) => {
      bottomHeight.value = entries[0].contentRect.height;
    });
    observer.observe(bottomRef.value);

    return () => {
      observer.disconnect();
    };
  });

  useSignalLayoutEffect(() => {
    if (!topRef.value) return;

    const observer = new ResizeObserver((entries) => {
      topHeight.value = entries[0].contentRect.height;
    });
    observer.observe(topRef.value);

    return () => {
      observer.disconnect();
    };
  });

  useSignalLayoutEffect(() => {
    if (!textRef.value) return;

    const observer = new ResizeObserver((entries) => {
      textHeight.value = entries[0].contentRect.height;
    });
    observer.observe(textRef.value);

    return () => {
      observer.disconnect();
    };
  });

  useSignalLayoutEffect(() => {
    if (!containerRef.value) return;

    if (state.value.type === 'smaller') {
      const duration = 500;
      const start = parseTime(state.value.start);
      {
        const anim = containerRef.value!.animate(
          {
            translate: '0 0',
            offset: 0,
          },
          {
            easing: 'ease',
            duration,
          }
        );

        anim.pause();
        activeAnimations.current.push({
          anim,
          start,
        });
      }
      {
        const anim = topRef.value!.animate(
          {
            clipPath: `inset(0 0 0 0)`,
            offset: 0,
          },
          {
            easing: 'ease',
            duration,
          }
        );

        anim.pause();
        activeAnimations.current.push({
          anim,
          start,
        });
      }
      {
        const anim = textInnerRef.value!.animate(
          {
            scale: `1`,
            offset: 0,
          },
          {
            easing: 'ease',
            duration,
          }
        );

        anim.pause();
        activeAnimations.current.push({
          anim,
          start,
        });
      }
    } else if (state.value.type === 'away') {
      const duration = 200;
      const start = parseTime(state.value.start);

      {
        const anim = containerRef.value!.animate(
          {
            translate: `0 var(--smaller-translate-y)`,
            offset: 0,
          },
          {
            easing: 'ease-in',
            duration,
          }
        );

        anim.pause();
        activeAnimations.current.push({
          anim,
          start,
        });
      }
    }

    return () => {
      for (const anim of activeAnimations.current) {
        anim.anim.cancel();
      }
      activeAnimations.current = [];
    };
  });

  useSignalLayoutEffect(() => {
    const currentTime = time.value;

    for (const anim of activeAnimations.current) {
      anim.anim.currentTime = currentTime - anim.start;
    }
  });

  return (
    <div class={styles.clipper}>
      <div ref={containerRef} class={containerClass} style={containerStyle}>
        <div ref={topRef} class={styles.top}>
          <div ref={textRef}>
            <div ref={textInnerRef} className={styles.textInner}>
              {config.text}
            </div>
          </div>
        </div>
        <div class={styles.middle}></div>
        <div ref={bottomRef} class={styles.bottom}></div>
      </div>
    </div>
  );
};

export default Title;
