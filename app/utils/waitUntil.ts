let waitUntilPromise = Promise.resolve();

export function waitUntil(promise: Promise<unknown>) {
  waitUntilPromise = waitUntilPromise
    .then(() => promise)
    .then(
      () => {},
      () => {}
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
