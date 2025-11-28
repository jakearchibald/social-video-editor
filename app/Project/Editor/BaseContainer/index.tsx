import type { FunctionComponent, ComponentChildren } from 'preact';
import { Signal, useComputed } from '@preact/signals';
import type { RevertDeepSignal } from 'deepsignal';
import type { Container as ContainerConfig } from '../../../../project-schema/timeline-items/container';
import { parseTime } from '../../../utils/time';
import { useRef } from 'preact/hooks';
import { useSignalRef } from '@preact/signals/utils';
import useSignalLayoutEffect from '../../../utils/useSignalLayoutEffect';

const div = document.createElement('div');

type SimpleCSSDeclaration = ContainerConfig['styles'];
type ContainerTimelineItem = NonNullable<ContainerConfig['timeline']>[number];

interface Props {
  time: Signal<number>;
  styles?: SimpleCSSDeclaration;
  timeline?: ContainerTimelineItem[];
  enter?: { type: 'fade'; duration?: number; start: number };
  exit?: { type: 'fade'; duration?: number; end: number };
  children?: ComponentChildren;
}

// Can't use 'offset' style in keyframes, as it means something else
function objWithoutOffset<T extends Record<string, any>>(
  obj: T
): Omit<T, 'offset'> {
  const { offset, ...rest } = obj;
  return rest;
}

const defaultEnterExitDuration = 250;

const BaseContainer: FunctionComponent<Props> = ({
  time,
  styles: initialStyles,
  timeline,
  enter,
  exit,
  children,
}) => {
  const containerRef = useSignalRef<HTMLDivElement | null>(null);
  const activeAnimations = useRef<Map<object, Animation>>(new Map());

  const style = useComputed(() => {
    if (!containerRef.current) return {};

    let styles = {
      ...(initialStyles as RevertDeepSignal<typeof initialStyles>),
    };

    const currentAnimations = new Set<Animation>();

    if (timeline) {
      for (const timelineItem of timeline) {
        const itemStart = parseTime(timelineItem.start);
        if (itemStart > time.value) {
          break;
        }

        if (timelineItem.type === 'set-styles') {
          styles = timelineItem.styles as RevertDeepSignal<
            typeof timelineItem.styles
          >;
        } else if (timelineItem.type === 'add-styles') {
          if (
            timelineItem.transition &&
            time.value < itemStart + timelineItem.transition.duration
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
            animation.currentTime = time.value - itemStart;
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

  const styleString = useComputed(() => {
    div.style.cssText = '';
    Object.assign(div.style, style.value);
    return div.style.cssText;
  });

  const enterAnim = useRef<Animation | null>(null);
  const exitAnim = useRef<Animation | null>(null);

  useSignalLayoutEffect(() => {
    if (enter) {
      enterAnim.current = containerRef.current!.animate(
        { offset: 0, opacity: '0' },
        {
          duration: enter.duration ?? defaultEnterExitDuration,
          easing: 'ease',
        }
      );
      enterAnim.current.pause();
    }

    if (exit) {
      const exitDuration = exit.duration ?? defaultEnterExitDuration;

      exitAnim.current = containerRef.current!.animate(
        { opacity: '0' },
        {
          duration: exitDuration,
          easing: 'ease',
          fill: 'forwards',
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
    if (enterAnim.current) {
      enterAnim.current.currentTime = time.value - enter!.start;
    }
    if (exitAnim.current) {
      exitAnim.current.currentTime =
        time.value - exit!.end + (exit!.duration ?? defaultEnterExitDuration);
    }
  });

  return (
    <div style={styleString} ref={containerRef}>
      {children}
    </div>
  );
};

export default BaseContainer;
