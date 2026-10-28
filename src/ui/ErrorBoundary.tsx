import { Component, ReactNode } from 'react';
import { SimpleSite } from './SimpleSite';

// Last line of defence: if anything in the React tree throws, show the plain version instead of
// a black screen.
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[TimeDrive] UI crashed, showing the simple version', error);
  }
  render() {
    if (this.state.failed) return <SimpleSite reason="error" onTry3d={() => window.location.reload()} />;
    return this.props.children;
  }
}