type Listener = (payload: unknown) => void;

const listeners = new Set<Listener>();

export function subscribeStudioEvents(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishStudioEvent(type: string, payload: unknown) {
  const message = { type, payload, at: Date.now() };
  for (const listener of listeners) {
    try {
      listener(message);
    } catch {
      /* ignore broken listeners */
    }
  }
}
