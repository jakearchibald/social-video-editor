import { render } from 'preact';
import { useSignal } from '@preact/signals';

import ProjectSelect from './ProjectSelect';
import './styles.css';
import Project from './Project';

function App() {
  const projectDir = useSignal<FileSystemDirectoryHandle | null>('./dummy');

  if (projectDir.value) return <Project projectDir={projectDir.value} />;

  console.log('rendering app');

  return (
    <ProjectSelect onProjectDirSelect={(dir) => (projectDir.value = dir)} />
  );
}

render(<App />, document.getElementById('app')!);
