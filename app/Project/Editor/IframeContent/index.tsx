import { type FunctionComponent, render } from 'preact';
import { type Signal } from '@preact/signals';

import { useLayoutEffect, useRef } from 'preact/hooks';
import useOptimComputed from '../../../utils/useOptimComputed';

interface Props {
  width: Signal<number>;
  height: Signal<number>;
}

const IframeContent: FunctionComponent<Props> = ({
  width,
  height,
  children,
}) => {
  const iframeStyle = useOptimComputed(
    () => `width: ${width.value}px; height: ${height.value}px;`
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useLayoutEffect(() => {
    if (!iframeRef.current) return;
    const iframeDoc = iframeRef.current.contentDocument!;

    function updateStyles() {
      const iframeStyles = iframeDoc.head.querySelectorAll('style');
      for (const style of iframeStyles) style.remove();

      const styles = document.head.querySelectorAll('style');
      for (const style of styles) {
        const newStyle = style.cloneNode(true);
        iframeDoc.head.appendChild(newStyle);
      }
    }

    const observer = new MutationObserver(() => {
      updateStyles();
    });

    observer.observe(document.head, {
      childList: true,
      subtree: true,
    });

    updateStyles();

    return () => {
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (!iframeRef.current) return;
    const iframeDoc = iframeRef.current.contentDocument!;
    render(children, iframeDoc.body);
  }, [children]);

  return <iframe src="about:blank" style={iframeStyle} ref={iframeRef} />;
};

export default IframeContent;
