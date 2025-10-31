import type { FunctionComponent } from 'preact';
import { type DeepSignal, peek } from 'deepsignal';
import { Signal } from '@preact/signals';
import type { Container as ContainerConfig } from '../../../../../project-schema/schema';

import styles from './styles.module.css';
import TimelineChildren from '../../TimelineChildren';
import useOptimComputed from '../../../../utils/useOptimComputed';

interface Props {
  time: Signal<number>;
  projectDir: FileSystemDirectoryHandle;
  config: DeepSignal<ContainerConfig>;
}

const Container: FunctionComponent<Props> = ({ config, time, projectDir }) => {
  const style = useOptimComputed(() => {
    config.styles;
    return peek(config, 'styles');
  });

  console.log('container render');
  return (
    <div class={styles.container} style={style}>
      <TimelineChildren
        projectDir={projectDir}
        time={time}
        childrenTimeline={config.childrenTimeline}
      />
    </div>
  );
};

export default Container;
