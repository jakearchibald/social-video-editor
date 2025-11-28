import type { FunctionComponent } from 'preact';
import { type DeepSignal } from 'deepsignal';
import { Signal, useComputed } from '@preact/signals';
import type { Container as ContainerConfig } from '../../../../../project-schema/timeline-items/container';
import TimelineChildren from '../../TimelineChildren';
import { parseTime } from '../../../../utils/time';
import { getDuration } from '../../../../utils/timeline-item';
import BaseContainer from '../../BaseContainer';

interface Props {
  time: Signal<number>;
  projectDir: FileSystemDirectoryHandle;
  config: DeepSignal<ContainerConfig>;
}

const Container: FunctionComponent<Props> = ({ config, time, projectDir }) => {
  const startValue = useComputed(() => parseTime(config.start));
  const durationValue = useComputed(() => getDuration(config));
  const endValue = useComputed(() => startValue.value + durationValue.value);

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
      />
    </BaseContainer>
  );
};

export default Container;
