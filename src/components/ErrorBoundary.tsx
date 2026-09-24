import React from 'react';

interface ErrorBoundaryProps {
  /** Short label shown in the fallback, e.g. "ARCADE STAGE". */
  label?: string;
  /** Optional custom fallback renderer. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render/runtime errors in its subtree so one broken section
 * (e.g. the game loop or the audio engine) can't blank the whole page.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the details in the console for debugging without surfacing raw
    // stack traces to visitors.
    console.error(`[${this.props.label ?? 'SECTION'}] crashed:`, error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4 py-24">
        <div className="max-w-lg w-full bg-[#110d24] border-2 border-[#ff2d78] p-6 sm:p-8 text-center shadow-[8px_8px_0_#000]">
          <span className="font-pixel text-[9px] px-3 py-2 bg-[#0a0817] border-2 border-[#ff2d78] text-[#ff2d78] inline-block mb-6">
            ⚠ SYSTEM FAULT
          </span>

          <h2 className="font-pixel text-sm sm:text-base text-white mb-3 leading-relaxed">
            {this.props.label ?? 'THIS SECTION'} FAILED TO LOAD
          </h2>

          <p className="font-retro text-xl text-slate-300 mb-6 leading-relaxed">
            The arcade cabinet jammed. Your score is safe and saved — try restarting this section.
          </p>

          <button
            type="button"
            onClick={this.reset}
            className="font-pixel text-xs px-6 py-4 bg-[#0a0817] border-2 border-[#3dffa2] text-[#3dffa2] hover:bg-[#3dffa2] hover:text-[#001016] transition-colors cursor-pointer shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none"
          >
            ▶ RESTART SECTION
          </button>

          <p className="font-pixel text-[8px] text-[#7d7aa3] mt-6 break-words">
            {error.message}
          </p>
        </div>
      </section>
    );
  }
}
