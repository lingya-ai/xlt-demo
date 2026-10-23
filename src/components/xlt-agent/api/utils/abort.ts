export function linkAbortSignals(
  controller: AbortController,
  signals: readonly (AbortSignal | null | undefined)[],
): () => void {
  const sources = [
    ...new Set(
      signals.filter((signal): signal is AbortSignal => Boolean(signal)),
    ),
  ];
  if (sources.some((signal) => signal.aborted)) {
    controller.abort();
    return () => undefined;
  }
  const abort = () => {
    controller.abort();
  };
  for (const signal of sources)
    signal.addEventListener("abort", abort, { once: true });
  return () => {
    for (const signal of sources) signal.removeEventListener("abort", abort);
  };
}
