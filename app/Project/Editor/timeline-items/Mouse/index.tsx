import type { FunctionComponent } from 'preact';
import { useComputed, type Signal } from '@preact/signals';
import type { DeepSignal } from 'deepsignal';
import type {
  Mouse as MouseConfig,
  MousePositionChange,
} from '../../../../../project-schema/timeline-items/mouse';
import mouseSVG from './images/cursor.svg?raw';
import styles from './styles.module.css';
import { useComputedShallow } from '../../../../utils/useComputedShallow';
import { parseTime } from '../../../../utils/time';
import useSignalLayoutEffect from '../../../../utils/useSignalLayoutEffect';
import { animateFromKeyed, animateKeyed } from '../../../../utils/animate';
import { useSignalRef } from '@preact/signals/utils';

const clickDownTime = 100;

interface Props {
  time: Signal<number>;
  config: DeepSignal<MouseConfig>;
}

const Mouse: FunctionComponent<Props> = ({ time, config }) => {
  const container = useSignalRef<HTMLDivElement | null>(null);
  const innerContainer = useSignalRef<HTMLDivElement | null>(null);

  const activeTimelineItems = useComputedShallow(() => {
    if (!config.timeline) return [];

    return config.timeline.filter((item) => {
      let actualStart = parseTime(item.start);

      if (item.type === 'click') {
        actualStart -= clickDownTime;
      } else if (item.type === 'position') {
        actualStart -= parseTime(item.duration);
      }

      return time.value >= actualStart;
    });
  });

  const mouseStyles = useComputed(() => {
    const timelineItem = activeTimelineItems.value.findLast(
      (item) => item.type === 'position'
    );
    const top = timelineItem ? timelineItem.top : config.top;
    const left = timelineItem ? timelineItem.left : config.left;

    return `translate: ${left}px ${top}px; scale: ${config.scale ?? 1}px;`;
  });

  useSignalLayoutEffect(() => {
    const latestPosition = activeTimelineItems.value.findLast(
      (item) => item.type === 'position'
    );
    const lastPositionItem = activeTimelineItems.value.findLast(
      (item) => item.type === 'position' && item !== latestPosition
    ) as MousePositionChange | undefined;

    if (latestPosition) {
      const lastPosition = lastPositionItem || {
        top: config.top,
        left: config.left,
      };

      const duration = parseTime(latestPosition.duration);

      animateFromKeyed(
        latestPosition,
        time,
        container.value!,
        parseTime(latestPosition.start) - duration,
        {
          translate: `${lastPosition.left}px ${lastPosition.top}px`,
        },
        {
          duration,
          easing:
            'linear(0, 0.01 3.6%, 0.034, 0.074 9.1%, 0.128 11.4%, 0.271 15%, 0.544 18.3%,0.66 20.6%, 0.717 22.4%, 0.765 24.6%, 0.808 27.3%, 0.845 30.4%, 0.883 35.1%,0.916 40.6%, 0.942 47.2%, 0.963 55%, 0.979 64%, 0.991 74.4%, 1)',
        }
      );
    }

    const clickItem = activeTimelineItems.value.findLast(
      (item) => item.type === 'click'
    );

    if (clickItem) {
      const clickStart = parseTime(clickItem.start) - clickDownTime;

      animateKeyed(
        clickItem,
        time,
        innerContainer.value!,
        clickStart,
        { scale: ['1', '0.7', '1'] },
        { duration: clickDownTime * 2, easing: 'ease' }
      );
    }
  });

  return (
    <div class={styles.mouse} style={mouseStyles} ref={container}>
      <div
        ref={innerContainer}
        class={styles.clicker}
        dangerouslySetInnerHTML={{ __html: mouseSVG }}
      />
    </div>
  );
};

export default Mouse;
