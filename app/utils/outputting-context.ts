import { createContext } from 'preact';
import { signal, type ReadonlySignal } from '@preact/signals';

/** Whether the video is being output, rather than previewed in the editor. */
export const OutputtingContext = createContext<ReadonlySignal<boolean>>(
  signal(false),
);
