declare global {
  interface CanvasRenderingContext2D {
    drawElementImage(
      element: Element,
      dx: number,
      dy: number,
      dw: number,
      dh: number
    ): void;
  }

  interface HTMLCanvasElement {
    requestPaint(): void;
  }

  namespace preact.JSX {
    interface CanvasHTMLAttributes {
      layoutsubtree?: boolean | undefined;
    }
  }
}

export {};
