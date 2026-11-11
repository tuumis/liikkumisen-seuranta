import { Component, type ReactNode } from 'react';

/** Odottamaton virhe näyttää viestin eikä tyhjää sivua; data on tallessa IndexedDB:ssä. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto max-w-xl p-4">
        <div className="space-y-3 rounded-2xl bg-red-50 p-4 text-sm text-red-950 ring-1 ring-red-200">
          <p>
            <strong>Jokin meni vikaan.</strong> Tallennetut tiedot ovat tallessa.
          </p>
          <p className="font-mono text-xs">{this.state.error.message}</p>
          <button type="button" className="min-h-11 rounded-xl bg-red-700 px-4 font-medium text-white" onClick={() => window.location.reload()}>
            Lataa uudelleen
          </button>
        </div>
      </main>
    );
  }
}
