import { useRef, useEffect, useCallback } from 'react';

// ============================================
// ABORT CONTROLLER HOOK
// Automatically aborts in-flight requests when dependencies change or component unmounts
// ============================================

export function useAbortController() {
  const controllerRef = useRef(null);

  const getSignal = useCallback(() => {
    // Abort any previous in-flight request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();
    return controllerRef.current.signal;
  }, []);

  const abort = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  return { getSignal, abort };
}

// ============================================
// SAFE ASYNC HOOK
// Wraps async operations to ignore aborted requests
// ============================================

export function useSafeAsync() {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const run = useCallback(async (asyncFn) => {
    try {
      const result = await asyncFn();
      if (mountedRef.current) {
        return result;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Request was aborted, this is expected
        return undefined;
      }
      throw err;
    }
  }, []);

  return { run, isMounted: () => mountedRef.current };
}
