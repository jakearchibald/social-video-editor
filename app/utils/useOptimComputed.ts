import { useComputed, type ReadonlySignal } from '@preact/signals';
import { useCallback } from 'preact/hooks';

export default function useOptimComputed<T>(
  callback: () => T,
  deps: readonly unknown[] = []
): ReadonlySignal<T> {
  const memoCallback = useCallback(callback, deps);
  return useComputed(memoCallback);
}
