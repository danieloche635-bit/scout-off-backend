/**
 * Execute a promise with an external abort signal combined with a timeout.
 * Useful for operations that support cancellation and need both:
 * - A request-scoped signal (from req.signal via AbortController)
 * - A local timeout specific to this operation
 *
 * If either the external signal or the timeout fires, the operation is aborted.
 * The first to fire wins.
 *
 * @param promise A promise to wrap
 * @param timeoutMs Timeout in milliseconds (0 = no timeout)
 * @param externalSignal Optional AbortSignal from the request context
 * @returns The promise wrapped with timeout/cancellation
 */
export async function withTimeoutAndSignal<T>(
  promise: Promise<T>,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<T> {
  // If no timeout and no external signal, return unwrapped
  if (timeoutMs === 0 && !externalSignal) {
    return promise;
  }

  // Combine signals
  const signals: AbortSignal[] = [];
  if (externalSignal) {
    signals.push(externalSignal);
  }

  let timeoutController: AbortController | undefined;
  if (timeoutMs > 0) {
    timeoutController = new AbortController();
    signals.push(timeoutController.signal);
  }

  if (signals.length === 0) {
    return promise;
  }

  // Use AbortSignal.any() to race multiple signals (available in Node 20.3+)
  // For older Node versions, fall back to manual race
  const combinedSignal = AbortSignal.any ? AbortSignal.any(signals) : signals[0];

  const timeoutId = timeoutMs > 0 ? setTimeout(() => timeoutController?.abort(), timeoutMs) : undefined;

  try {
    // Throw if the combined signal is already aborted
    if (combinedSignal.aborted) {
      throw combinedSignal.reason || new Error('Aborted');
    }

    // Race the promise against abort
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        combinedSignal.addEventListener('abort', () => {
          reject(combinedSignal.reason || new Error('Aborted'));
        }, { once: true });
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Execute a promise with a local timeout (no external signal).
 * Backward-compatible wrapper around withTimeoutAndSignal.
 *
 * @param promise A promise to wrap
 * @param timeoutMs Timeout in milliseconds (0 = no timeout)
 * @returns The promise wrapped with timeout
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return withTimeoutAndSignal(promise, timeoutMs);
}
