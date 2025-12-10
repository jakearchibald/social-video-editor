import type { FunctionComponent } from 'preact';
import { type DeepSignal } from 'deepsignal';
import { Signal, useComputed } from '@preact/signals';
import type { Container as ContainerConfig } from '../../../../../project-schema/timeline-items/container';
import TimelineChildren from '../../TimelineChildren';
import { getStartTime, getEndTime } from '../../../../utils/timeline-item';
import BaseContainer from '../../BaseContainer';

interface Props {
  time: Signal<number>;
  projectDir: FileSystemDirectoryHandle;
  config: DeepSignal<ContainerConfig>;
  parentStart: number;
  parentEnd: number;
}

const Container: FunctionComponent<Props> = ({ config, time, projectDir, parentStart, parentEnd }) => {
  const startValue = useComputed(() => getStartTime(config, parentStart));
  const endValue = useComputed(() => getEndTime(config, parentStart, parentEnd));

  const computedEnter = useComputed(() => {
    if (!config.enter) return undefined;
    return {
      ...config.enter,
      start: startValue.value,
    };
  });

  const computedExit = useComputed(() => {
    if (!config.exit) return undefined;
    return {
      ...config.exit,
      end: endValue.value,
    };
  });

  console.log('container render');

  return (
    <BaseContainer
      time={time}
      styles={config.styles}
      timeline={config.timeline}
      enter={computedEnter.value}
      exit={computedExit.value}
    >
      <TimelineChildren
        projectDir={projectDir}
        time={time}
        childrenTimeline={config.childrenTimeline}
        parentStart={startValue.value}
        parentEnd={endValue.value}
      />
    </BaseContainer>
  );
};

export default Container;
