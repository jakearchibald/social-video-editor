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

interface FormatTimeOptions {
  forceMinutes?: boolean;
  forceSeconds?: boolean;
  milliDecimalPlaces?: number;
}

export function formatTime(
  ms: number,
  options: FormatTimeOptions = {}
): string {
  const frac = (ms % 1000) / 1000;
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  let result = '';

  if (hours > 0) {
    result += `${hours}:`;
  }

  if (minutes > 0 || result || options.forceMinutes) {
    result += `${
      result || options.forceMinutes
        ? String(minutes).padStart(2, '0')
        : minutes
    }:`;
  }

  result +=
    result || options.forceSeconds
      ? String(seconds).padStart(2, '0')
      : String(seconds);

  if (frac > 0 || options.milliDecimalPlaces !== undefined) {
    let fracStr = String(frac).slice(2);
    if (options.milliDecimalPlaces !== undefined) {
      fracStr = fracStr.slice(0, options.milliDecimalPlaces);
      fracStr = fracStr.padEnd(options.milliDecimalPlaces, '0');
    }
    result += `.${fracStr}`;
  }

  return result;
}
