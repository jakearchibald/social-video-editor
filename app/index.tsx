import { render } from 'preact';
import { useSignal } from '@preact/signals';

import ProjectSelect from './ProjectSelect';
import './styles.module.css';
import Project from './Project';

function App() {
  const projectDir = useSignal<FileSystemDirectoryHandle | null>(null);

  if (projectDir.value) return <Project projectDir={projectDir.value} />;

  console.log('rendering app');

  return (
    <ProjectSelect onProjectDirSelect={(dir) => (projectDir.value = dir)} />
  );
}

render(<App />, document.getElementById('app')!);
