import { render } from 'preact';
import { useSignal } from '@preact/signals';

import ProjectSelect from './ProjectSelect';
import './styles.module.css';
import Editor from './Editor';

function App() {
  const projectDir = useSignal<FileSystemDirectoryHandle | null>(null);

  if (projectDir.value) return <Editor projectDir={projectDir.value} />;

  return (
    <ProjectSelect onProjectDirSelect={(dir) => (projectDir.value = dir)} />
  );
}

render(<App />, document.getElementById('app')!);
