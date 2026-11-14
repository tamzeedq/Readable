import { Component, type ErrorInfo, type ReactNode } from 'react';
import './Notice.css';

interface Props {
  children: ReactNode;
  /** 'app' fills the screen; 'reader' replaces just the reader. */
  scope?: 'app' | 'reader';
  /** Called by the "Go to library" action in addition to resetting. */
  onLibrary?: () => void;
  /** Changing this value clears a caught error (e.g. a different book id). */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  private library = () => {
    this.props.onLibrary?.();
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    const reader = this.props.scope === 'reader';
    return (
      <div className={`fallback ${reader ? 'fallback-reader' : 'fallback-app'}`} role="alert">
        <div className="fallback-card">
          <h1 className="fallback-title">{reader ? 'This book couldn’t be shown' : 'Something went wrong'}</h1>
          <p className="fallback-text">
            {reader
              ? 'The reader hit a problem opening this book. Your library and reading progress are safe.'
              : 'Readable ran into an unexpected problem. Your books and progress are stored on this device and haven’t been touched.'}
          </p>
          <div className="fallback-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            {this.props.onLibrary && (
              <button type="button" className="btn" onClick={this.library}>
                Go to library
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
