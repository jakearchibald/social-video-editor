import { useComputed, type ReadonlySignal } from '@preact/signals';

export function parseTime(timeStr: string | number): number {
  if (typeof timeStr === 'number') return timeStr;
  const parts = timeStr.split(':').map(Number);
  const reversedParts = parts.slice().reverse();

  let ms = 0;

  for (const [index, part] of reversedParts.entries()) {
    ms += part * Math.pow(60, index) * 1000;
  }

  return ms;
}

export function useComputedTime(
  time: ReadonlySignal<string | number>
): ReadonlySignal<number> {
  return useComputed(() => {
    const value = time.value;
    if (typeof value === 'string') {
      return parseTime(value);
    }
    return value;
  });
}

export function formatTime(ms: number): string {
  const frac = (ms % 1000) / 1000;
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  let result = '';

  if (hours > 0) {
    result += `${hours}:`;
  }

  if (minutes > 0 || result) {
    result += `${result ? String(minutes).padStart(2, '0') : minutes}:`;
  }

  result += result ? String(seconds).padStart(2, '0') : String(seconds);

  if (frac > 0) {
    result += `.${String(frac).slice(2)}`;
  }

  return result;
}
