import type { FunctionComponent } from 'preact';
import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import {
  getProjectDir,
  setProjectDir,
  getProjectIds,
  deleteProjectDir,
} from '../idb';

const urlParams = new URLSearchParams(location.search);
const urlProjectId = urlParams.get('projectId');

interface Props {
  onProjectDirSelect?: (dirHandle: FileSystemDirectoryHandle) => void;
}

const ProjectSelect: FunctionComponent<Props> = ({ onProjectDirSelect }) => {
  const projectIds = useSignal<string[]>([]);
  const error = useSignal<string>('');

  const loadProjectIds = async () => {
    const ids = await getProjectIds();
    projectIds.value = ids;
  };

  const loadProject = async (dir: FileSystemDirectoryHandle) => {
    // Check if index.json exists in the directory
    try {
      await dir.getFileHandle('index.json');
    } catch (err) {
      error.value = `Cannot find or open index.json in selected directory: ${err}`;
    }

    // Save to IDB
    await setProjectDir(dir.name, dir);

    const newURL = new URL(location.href);
    newURL.searchParams.set('projectId', dir.name);
    history.replaceState(null, '', newURL.href);

    // Notify parent component if callback provided
    onProjectDirSelect?.(dir);
  };

  useEffect(() => {
    loadProjectIds();

    if (urlProjectId) {
      (async () => {
        const dirHandle = await getProjectDir(urlProjectId);
        if (!dirHandle) {
          error.value = 'Project directory not found in storage.';
          return;
        }
        loadProject(dirHandle);
      })();
    }
  }, []);

  const onSelectDirectory = async () => {
    try {
      const directoryHandle = await showDirectoryPicker({
        mode: 'readwrite',
      });

      loadProject(directoryHandle);
    } catch (err) {
      error.value = `Error selecting directory: ${err}`;
    }
  };

  const onProjectClick = async (projectId: string) => {
    const dirHandle = await getProjectDir(projectId);
    if (!dirHandle) {
      error.value = 'Project directory not found in storage.';
      return;
    }
    loadProject(dirHandle);
  };

  const onRemoveProject = async (projectId: string) => {
    await deleteProjectDir(projectId);
    loadProjectIds();
  };

  return (
    <div>
      <h1>Select a project</h1>

      {projectIds.value.length > 0 && (
        <div>
          <h2>Recent Projects</h2>
          <ul>
            {projectIds.value.map((id: string) => (
              <li key={id}>
                <button onClick={() => onProjectClick(id)}>{id}</button>{' '}
                <button onClick={() => onRemoveProject(id)}>
                  Remove from list
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error.value && (
        <>
          <h2>Error</h2>
          <div>{error}</div>
        </>
      )}

      <button onClick={onSelectDirectory}>Open New Directory</button>
    </div>
  );
};

export default ProjectSelect;
