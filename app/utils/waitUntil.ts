let waitUntilPromise = Promise.resolve();

export function waitUntil(promise: Promise<unknown>) {
  waitUntilPromise = waitUntilPromise
    .then(() => promise)
    .then(
      () => {},
      (err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Error in waitUntil:', err);
      }
    );
}

export async function wait() {
  while (true) {
    const localWaitUntilPromise = waitUntilPromise;
    await localWaitUntilPromise;
    await 0;
    if (localWaitUntilPromise === waitUntilPromise) {
      return;
    }
  }
}
