import { effect, type Signal } from '@preact/signals';

const activeAnims = new WeakSet<object>();

export function animateFrom(
  time: Signal<number>,
  element: Element,
  start: number,
  from: PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions
): Animation | null {
  if (time.value < start) return null;
  if (time.value > start + (options.duration as number)) return null;

  const anim = element.animate(
    { ...from, offset: 0 },
    {
      ...options,
      fill: 'backwards',
    }
  );
  anim.pause();
  anim.currentTime = time.value - start;

  const disposeEffect = effect(() => {
    const stopAnim =
      !element.isConnected ||
      time.value < start ||
      time.value > start + (options.duration as number);

    if (stopAnim) {
      disposeEffect();
      anim.cancel();
      return;
    }

    anim.currentTime = time.value - start;
  });

  return anim;
}

export function animateFromKeyed(
  key: object,
  ...args: Parameters<typeof animateFrom>
) {
  if (activeAnims.has(key)) return;
  const anim = animateFrom(...args);
  if (!anim) return;

  activeAnims.add(key);

  anim.finished
    .finally(() => {
      console.log('cleaning anim');
      activeAnims.delete(key);
    })
    .catch(() => {});
}
