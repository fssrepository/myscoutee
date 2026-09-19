/** Let the loading surface paint before synchronous component/render work starts. */
export function scheduleAfterPaint(work: () => void): () => void {
  let cancelled = false;
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      if (!cancelled) work();
    });
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
  };
}
