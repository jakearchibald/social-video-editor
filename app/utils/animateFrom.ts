import { effect, type Signal } from '@preact/signals';

const activeAnims = new WeakSet<object>();

export function animate(
  time: Signal<number>,
  element: Element,
  start: number,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions
): Animation | null {
  if (time.peek() < start) return null;
  if (time.peek() > start + (options.duration as number)) return null;

  const anim = element.animate(keyframes, {
    ...options,
    fill: 'backwards',
  });
  anim.pause();
  anim.currentTime = time.peek() - start;

  const disposeEffect = effect(() => {
    const stopAnim = !element.isConnected || time.value < start;

    if (stopAnim) {
      disposeEffect();
      anim.cancel();
      return;
    }

    anim.currentTime = time.value - start;
  });

  return anim;
}

export function animateFrom(
  time: Signal<number>,
  element: Element,
  start: number,
  from: PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions
): Animation | null {
  return animate(time, element, start, { ...from, offset: 0 }, options);
}

export function animateKeyed(key: object, ...args: Parameters<typeof animate>) {
  if (activeAnims.has(key)) return;
  const anim = animate(...args);
  if (!anim) return;

  activeAnims.add(key);

  anim.finished
    .finally(() => {
      activeAnims.delete(key);
    })
    .catch(() => {});
}

export function animateFromKeyed(
  key: object,
  time: Signal<number>,
  element: Element,
  start: number,
  from: PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions
) {
  return animateKeyed(
    key,
    time,
    element,
    start,
    { ...from, offset: 0 },
    options
  );
}
