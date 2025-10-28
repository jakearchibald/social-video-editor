import { render } from 'preact';
import './styles.module.css';

function App() {
  return <p>Hello</p>;
}

render(<App />, document.getElementById('app')!);
