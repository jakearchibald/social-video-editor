import type { FunctionComponent } from 'preact';
import styles from './styles.module.css';

interface Props {
  width: number;
  height: number;
}

const SafeArea: FunctionComponent<Props> = ({ width, height }) => {
  return (
    <div
      class={styles.container}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <div class={styles.unsafe} />
      <div class={styles.middle}>
        <div class={styles.unsafe} />
        <div />
        <div class={styles.unsafe} />
      </div>
      <div class={styles.lower}>
        <div class={styles.unsafe} />
        <div />
        <div class={styles.unsafe} />
      </div>
      <div class={styles.unsafe} />
    </div>
  );
};

export default SafeArea;
