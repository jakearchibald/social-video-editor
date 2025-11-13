export function shallowEqual<T extends Record<string, any> | any[]>(
  objA: T | null,
  objB: T | null
): boolean {
  if (objA === objB) {
    return true;
  }

  if (objA === null || objB === null) {
    return false;
  }

  if (Array.isArray(objA) && Array.isArray(objB)) {
    if (objA.length !== objB.length) {
      return false;
    }

    for (let i = 0; i < objA.length; i++) {
      if (objA[i] !== objB[i]) {
        return false;
      }
    }

    return true;
  }

  if (Array.isArray(objA) !== Array.isArray(objB)) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (
      (objA as Record<string, any>)[key] !== (objB as Record<string, any>)[key]
    ) {
      return false;
    }
  }

  return true;
}
