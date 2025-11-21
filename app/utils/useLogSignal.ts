import type { Signal } from '@preact/signals';
import useSignalLayoutEffect from './useSignalLayoutEffect';

export function useLogSignal(signal: Signal<any>, ...preLog: any[]) {
  useSignalLayoutEffect(() => {
    console.log(...preLog, signal.value);
  });
}
