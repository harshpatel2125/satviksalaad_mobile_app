type Listener = () => void;

let _listener: Listener | null = null;

export const popupEvents = {
  /** Only one listener is kept; a new subscription replaces the previous one. */
  subscribe(fn: Listener): () => void {
    _listener = fn;
    return () => { if (_listener === fn) _listener = null; };
  },
  emit(): void {
    _listener?.();
  },
};
