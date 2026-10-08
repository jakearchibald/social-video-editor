declare global {
  interface CanvasRenderingContext2D {
    drawElementImage(
      element: Element,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
      options?: { preserveElementGeometry?: boolean }
    ): void;
    /** Non-standard. Only exposed to web content in a patched Firefox build. */
    drawWindow(
      window: Window,
      x: number,
      y: number,
      w: number,
      h: number,
      bgColor: string,
      flags?: number
    ): void;
  }

  interface HTMLCanvasElement {
    requestPaint(): void;
  }

  namespace preact.JSX {
    interface HTMLAttributes {
      drawable?: boolean | undefined;
    }

    interface CanvasHTMLAttributes {
      content?: 'fallback' | 'drawable' | undefined;
    }
  }
}

export {};
