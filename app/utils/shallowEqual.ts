export function shallowEqual<T extends Record<string, any>>(
  objA: T | null,
  objB: T | null
): boolean {
  if (objA === objB) {
    return true;
  }

  if (objA === null || objB === null) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (objA[key] !== objB[key]) {
      return false;
    }
  }

  return true;
}
