import type { FunctionComponent } from 'preact';
import { type Signal, useComputed } from '@preact/signals';
import styles from './styles.module.css';
import type { DeepSignal } from 'deepsignal';
import type { Title as TitleConfig } from '../../../../../project-schema/timeline-items/title';

interface Props {
  time: Signal<number>;
  config: DeepSignal<TitleConfig>;
}

const Title: FunctionComponent<Props> = ({ config }) => {
  const topStyle = useComputed(() => {
    if (!config.fontSize) return '';
    return `font-size: ${config.fontSize};`;
  });

  return (
    <div class={styles.clipper}>
      <div class={styles.container}>
        <div class={styles.top} style={topStyle}>
          <div>
            <div>{config.text}</div>
          </div>
        </div>
        <div class={styles.middle} />
        <div class={styles.bottom} />
      </div>
    </div>
  );
};

export default Title;
