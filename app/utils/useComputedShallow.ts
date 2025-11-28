import { useComputed, type Signal } from '@preact/signals';
import { useRef } from 'preact/hooks';
import { shallowEqual } from './shallowEqual';

export function useComputedShallow<T extends Record<string, any> | any[]>(
  fn: () => T
): Signal<T> {
  const lastValue = useRef<T | null>(null);

  return useComputed(() => {
    const newValue = fn();

    if (shallowEqual(newValue, lastValue.current)) {
      return lastValue.current!;
    }
    lastValue.current = newValue;
    return newValue;
  });
}
