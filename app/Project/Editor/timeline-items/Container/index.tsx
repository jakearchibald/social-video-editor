import type { FunctionComponent } from 'preact';
import { type DeepSignal } from 'deepsignal';
import { Signal } from '@preact/signals';
import type { Container as ContainerConfig } from '../../../../../project-schema/timeline-items/container';
import TimelineChildren from '../../TimelineChildren';
import useOptimComputed from '../../../../utils/useOptimComputed';
import { parseTime } from '../../../../utils/time';
import { getDuration } from '../../../../utils/timeline-item';
import BaseContainer from '../../BaseContainer';

interface Props {
  time: Signal<number>;
  projectDir: FileSystemDirectoryHandle;
  config: DeepSignal<ContainerConfig>;
}

const Container: FunctionComponent<Props> = ({ config, time, projectDir }) => {
  const startValue = useOptimComputed(() => parseTime(config.start));
  const durationValue = useOptimComputed(() => getDuration(config));

  console.log('container render');

  return (
    <BaseContainer
      time={time}
      start={startValue}
      duration={durationValue}
      styles={config.styles}
      timeline={config.timeline}
      enter={config.enter}
      exit={config.exit}
    >
      <TimelineChildren
        projectDir={projectDir}
        time={time}
        childrenTimeline={config.childrenTimeline}
      />
    </BaseContainer>
  );
};

export default Container;
