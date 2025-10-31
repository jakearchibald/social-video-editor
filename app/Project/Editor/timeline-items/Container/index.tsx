import type { FunctionComponent } from 'preact';
import { type DeepSignal, type RevertDeepSignal, peek } from 'deepsignal';
import { Signal } from '@preact/signals';
import type { Container as ContainerConfig } from '../../../../../project-schema/schema';

import styles from './styles.module.css';
import TimelineChildren from '../../TimelineChildren';
import useOptimComputed from '../../../../utils/useOptimComputed';
import { parseTime } from '../../../../utils/time';

const div = document.createElement('div');

interface Props {
  time: Signal<number>;
  projectDir: FileSystemDirectoryHandle;
  config: DeepSignal<ContainerConfig>;
}

const Container: FunctionComponent<Props> = ({ config, time, projectDir }) => {
  const style = useOptimComputed(() => {
    let styles = {
      ...(config.styles as RevertDeepSignal<typeof config.styles>),
    };

    if (config.timeline) {
      for (const timelineItem of config.timeline) {
        if (parseTime(timelineItem.start) > time.value) {
          break;
        }

        if (timelineItem.type === 'set-styles') {
          styles = timelineItem.styles as RevertDeepSignal<
            typeof timelineItem.styles
          >;
        } else if (timelineItem.type === 'add-styles') {
          Object.assign(
            styles,
            timelineItem.styles as RevertDeepSignal<typeof timelineItem.styles>
          );
        }
      }
    }

    return styles;
  });

  const styleString = useOptimComputed(() => {
    div.style.cssText = '';
    Object.assign(div.style, style.value);
    return div.style.cssText;
  });

  console.log('container render');

  return (
    <div class={styles.container} style={styleString}>
      <TimelineChildren
        projectDir={projectDir}
        time={time}
        childrenTimeline={config.childrenTimeline}
      />
    </div>
  );
};

export default Container;
