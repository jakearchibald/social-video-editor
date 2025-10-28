export function parseTime(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  const reversedParts = parts.slice().reverse();

  let ms = 0;

  for (const [index, part] of reversedParts.entries()) {
    ms += part * Math.pow(60, index + 1);
  }

  return ms;
}
