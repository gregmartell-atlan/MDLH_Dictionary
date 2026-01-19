/**
 * usePerformanceMetric - Hook for performance monitoring
 * 
 * Stub implementation for performance metric tracking.
 */

import { useEffect, useRef } from 'react';

interface PerformanceThresholds {
  warning?: number;
  error?: number;
}

export function usePerformanceMetric(
  metricName: string,
  thresholds?: PerformanceThresholds
) {
  const startTime = useRef(performance.now());

  useEffect(() => {
    const duration = performance.now() - startTime.current;
    
    if (thresholds?.error && duration > thresholds.error) {
      console.warn(`[Performance] ${metricName} exceeded error threshold: ${duration.toFixed(2)}ms > ${thresholds.error}ms`);
    } else if (thresholds?.warning && duration > thresholds.warning) {
      console.debug(`[Performance] ${metricName} exceeded warning threshold: ${duration.toFixed(2)}ms > ${thresholds.warning}ms`);
    }
  }, [metricName, thresholds]);

  return {
    measureEnd: () => {
      const duration = performance.now() - startTime.current;
      return duration;
    },
  };
}

export default usePerformanceMetric;
