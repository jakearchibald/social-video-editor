import { effect, type Signal } from '@preact/signals';

const activeAnims = new WeakSet<object>();

export function animateFrom(
  time: Signal<number>,
  key: object,
  element: Element,
  start: number,
  from: PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions
) {
  if (activeAnims.has(key)) return;
  if (time.value < start) return;
  if (time.value > start + (options.duration as number)) return;

  const anim = element.animate(
    { ...from, offset: 0 },
    {
      ...options,
      fill: 'backwards',
    }
  );
  anim.pause();
  anim.currentTime = time.value - start;

  activeAnims.add(key);

  const disposeEffect = effect(() => {
    const stopAnim =
      !element.isConnected ||
      time.value < start ||
      time.value > start + (options.duration as number);

    if (stopAnim) {
      disposeEffect();
      activeAnims.delete(key);
      anim.cancel();
      return;
    }

    anim.currentTime = time.value - start;
  });
}
