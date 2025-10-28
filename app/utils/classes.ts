export function classes(classesObj: {
  [key: string]: boolean | undefined;
}): string {
  return Object.entries(classesObj)
    .filter(([_, value]) => value)
    .map(([key]) => key)
    .join(' ');
}
