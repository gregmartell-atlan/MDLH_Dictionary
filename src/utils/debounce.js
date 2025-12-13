/**
 * Debounce and throttle utilities
 *
 * Prevents hammering the backend with rapid requests:
 * - debounce: Wait for pause in calls (good for search)
 * - throttle: Max one call per interval (good for scroll)
 * - debounceAsync: Debounce that returns a promise
 */

/**
 * Debounce - delays execution until calls stop
 *
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms (default 300)
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay = 300) {
  let timeoutId = null;

  const debounced = (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  debounced.flush = (...args) => {
    debounced.cancel();
    fn(...args);
  };

  return debounced;
}

/**
 * Throttle - max one call per interval
 *
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Min interval between calls in ms
 * @returns {Function} Throttled function
 */
export function throttle(fn, limit = 100) {
  let inThrottle = false;
  let lastArgs = null;

  const throttled = (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          throttled(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };

  return throttled;
}

/**
 * Async debounce - returns a promise that resolves when debounce completes
 *
 * @param {Function} fn - Async function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced async function
 */
export function debounceAsync(fn, delay = 300) {
  let timeoutId = null;
  let pendingResolve = null;
  let pendingReject = null;

  return (...args) => {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        // Reject the previous pending promise
        if (pendingReject) {
          pendingReject(new Error('Debounced'));
        }
      }

      pendingResolve = resolve;
      pendingReject = reject;

      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          pendingResolve(result);
        } catch (err) {
          pendingReject(err);
        }
        timeoutId = null;
        pendingResolve = null;
        pendingReject = null;
      }, delay);
    });
  };
}

/**
 * Leading edge debounce - executes immediately, then debounces
 *
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced function
 */
export function debounceLeading(fn, delay = 300) {
  let timeoutId = null;
  let lastCall = 0;

  return (...args) => {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
        timeoutId = null;
      }, delay - (now - lastCall));
    }
  };
}

/**
 * React hook for debounced value
 *
 * @param {any} value - Value to debounce
 * @param {number} delay - Delay in ms
 * @returns {any} Debounced value
 */
export function useDebouncedValue(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * React hook for debounced callback
 *
 * @param {Function} callback - Callback to debounce
 * @param {number} delay - Delay in ms
 * @param {Array} deps - Dependencies array
 * @returns {Function} Debounced callback
 */
export function useDebouncedCallback(callback, delay = 300, deps = []) {
  const callbackRef = React.useRef(callback);

  React.useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return React.useMemo(
    () => debounce((...args) => callbackRef.current(...args), delay),
    [delay, ...deps]
  );
}

// Import React for hooks
import React from 'react';

export default {
  debounce,
  throttle,
  debounceAsync,
  debounceLeading,
  useDebouncedValue,
  useDebouncedCallback,
};
