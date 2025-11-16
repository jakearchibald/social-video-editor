import type { FunctionComponent } from 'preact';
import { type DeepSignal, type RevertDeepSignal } from 'deepsignal';
import { Signal } from '@preact/signals';
import type { Container as ContainerConfig } from '../../../../../project-schema/timeline-items/container';
import TimelineChildren from '../../TimelineChildren';
import useOptimComputed from '../../../../utils/useOptimComputed';
import { parseTime } from '../../../../utils/time';
import { useRef } from 'preact/hooks';
import { useSignalRef } from '@preact/signals/utils';
import useSignalLayoutEffect from '../../../../utils/useSignalLayoutEffect';
import { getDuration } from '../../../../utils/timeline-item';

const div = document.createElement('div');

interface Props {
  time: Signal<number>;
  projectDir: FileSystemDirectoryHandle;
  config: DeepSignal<ContainerConfig>;
}

// Can't use 'offset' style in keyframes, as it means something else
function objWithoutOffset<T extends Record<string, any>>(
  obj: T
): Omit<T, 'offset'> {
  const { offset, ...rest } = obj;
  return rest;
}

const Container: FunctionComponent<Props> = ({ config, time, projectDir }) => {
  const containerRef = useSignalRef<HTMLDivElement | null>(null);
  const activeAnimations = useRef<Map<object, Animation>>(new Map());

  const style = useOptimComputed(() => {
    if (!containerRef.current) return {};

    let styles = {
      ...(config.styles as RevertDeepSignal<typeof config.styles>),
    };

    const currentAnimations = new Set<Animation>();

    if (config.timeline) {
      for (const timelineItem of config.timeline) {
        const start = parseTime(timelineItem.start);
        if (start > time.value) {
          break;
        }

        if (timelineItem.type === 'set-styles') {
          styles = timelineItem.styles as RevertDeepSignal<
            typeof timelineItem.styles
          >;
        } else if (timelineItem.type === 'add-styles') {
          if (
            timelineItem.transition &&
            time.value < start + timelineItem.transition.duration
          ) {
            const oldStyles = Object.fromEntries(
              Object.keys(timelineItem.styles).map((key) => [
                key,
                styles[key as keyof typeof styles] || '',
              ])
            ) as typeof styles;

            if (!activeAnimations.current.has(timelineItem)) {
              const animation = containerRef.current!.animate(
                [
                  objWithoutOffset(oldStyles),
                  objWithoutOffset(timelineItem.styles),
                ],
                {
                  duration: timelineItem.transition.duration,
                  easing: timelineItem.transition.easing,
                }
              );
              animation.pause();
              activeAnimations.current.set(timelineItem, animation);
            }

            const animation = activeAnimations.current.get(timelineItem)!;
            animation.currentTime = time.value - start;
            currentAnimations.add(animation);
          }

          Object.assign(
            styles,
            timelineItem.styles as RevertDeepSignal<typeof timelineItem.styles>
          );
        }
      }
    }

    for (const [key, anim] of activeAnimations.current) {
      if (!currentAnimations.has(anim)) {
        anim.cancel();
        activeAnimations.current.delete(key);
      }
    }

    return styles;
  });

  const styleString = useOptimComputed(() => {
    div.style.cssText = '';
    Object.assign(div.style, style.value);
    return div.style.cssText;
  });

  const enterAnim = useRef<Animation | null>(null);
  const exitAnim = useRef<Animation | null>(null);

  useSignalLayoutEffect(() => {
    if (config.enter) {
      enterAnim.current = containerRef.current!.animate(
        { offset: 0, opacity: '0' },
        {
          duration: config.enter.duration ?? 250,
          easing: 'ease',
        }
      );
      enterAnim.current.pause();
    }

    if (config.exit) {
      const duration = config.exit.duration ?? 250;

      exitAnim.current = containerRef.current!.animate(
        { opacity: '0' },
        {
          duration,
          delay: getDuration(config) - duration,
          easing: 'ease',
        }
      );
      exitAnim.current.pause();
    }

    return () => {
      enterAnim.current?.cancel();
      enterAnim.current = null;
      exitAnim.current?.cancel();
      exitAnim.current = null;
    };
  });

  useSignalLayoutEffect(() => {
    const start = parseTime(config.start);

    if (enterAnim.current) {
      enterAnim.current.currentTime = time.value - start;
    }
    if (exitAnim.current) {
      exitAnim.current.currentTime = time.value - start;
    }
  });

  console.log('container render');

  return (
    <div style={styleString} ref={containerRef}>
      <TimelineChildren
        projectDir={projectDir}
        time={time}
        childrenTimeline={config.childrenTimeline}
      />
    </div>
  );
};

export default Container;
