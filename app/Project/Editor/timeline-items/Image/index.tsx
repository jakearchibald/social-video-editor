import type { FunctionComponent } from 'preact';
import { useSignal, type Signal } from '@preact/signals';
import { useLayoutEffect } from 'preact/hooks';
import type { DeepSignal } from 'deepsignal';
import type { Image as ImageConfig } from '../../../../../project-schema/timeline-items/image';
import { waitUntil } from '../../../../utils/waitUntil';
import { getFile } from '../../../../utils/file';
import styles from './styles.module.css';
import useSignalLayoutEffect from '../../../../utils/useSignalLayoutEffect';
import { useSignalRef } from '@preact/signals/utils';

interface Props {
  projectDir: FileSystemDirectoryHandle;
  time: Signal<number>;
  config: DeepSignal<ImageConfig>;
}

const Image: FunctionComponent<Props> = ({ projectDir, config }) => {
  const imageRef = useSignalRef<HTMLImageElement | null>(null);
  const imageUrl = useSignal<string | null>(null);

  useLayoutEffect(() => {
    const p = (async () => {
      const file = await getFile(projectDir, config.source);
      const url = URL.createObjectURL(file);
      imageUrl.value = url;
    })();

    waitUntil(p);

    return () => {
      if (imageUrl.value) {
        URL.revokeObjectURL(imageUrl.value);
      }
    };
  }, []);

  useSignalLayoutEffect(() => {
    if (!imageRef.current) return;
    waitUntil(imageRef.current.decode());
  });

  if (!imageUrl.value) return null;

  return <img ref={imageRef} class={styles.image} src={imageUrl.value} />;
};

export default Image;
