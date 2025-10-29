import {
  Signal,
  useSignal,
  useSignalEffect,
  type ReadonlySignal,
} from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';

export default function useThrottledSignal<T>(
  signal: Signal<T>,
  cooloff: number
): ReadonlySignal<T> {
  const throttledSignal = useSignal(signal.peek());
  const timeoutId = useRef<number | null>(null);

  useSignalEffect(() => {
    // Make sure value is read, so it stays reactive.
    signal.valueOf();

    if (timeoutId.current === null) {
      timeoutId.current = setTimeout(() => {
        throttledSignal.value = signal.value;
        timeoutId.current = null;
      }, cooloff);

      throttledSignal.value = signal.value;
    }
  });

  useEffect(() => {
    return () => {
      if (timeoutId.current !== null) {
        clearTimeout(timeoutId.current);
      }
    };
  }, []);

  return throttledSignal;
}
