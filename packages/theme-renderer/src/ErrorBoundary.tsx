import { Component, type ErrorInfo, type ReactNode } from "react";

export interface RenderErrorBoundaryProps {
  children: ReactNode;
  fallback: (error: Error) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface RenderErrorBoundaryState {
  error: Error | null;
}

/**
 * A boundary that isolates a rendering failure to whatever subtree it
 * wraps. Used at two granularities: once around a whole page/popup (so an
 * invalid theme never takes down a host that embeds it — "leaving FDraft
 * usable") and once around each individual layer (so one bad layer
 * doesn't blank the rest of an otherwise-valid page).
 */
export class RenderErrorBoundary extends Component<RenderErrorBoundaryProps, RenderErrorBoundaryState> {
  state: RenderErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RenderErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}
