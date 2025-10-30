import { effect, type useSignalEffect } from '@preact/signals';
import { useLayoutEffect, useRef } from 'preact/hooks';

const useSignalLayoutEffect: typeof useSignalEffect = (cb) => {
  const callback = useRef(cb);
  callback.current = cb;
  useLayoutEffect(() => effect(() => callback.current()), []);
};

export default useSignalLayoutEffect;
