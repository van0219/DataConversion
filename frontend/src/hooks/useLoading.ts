import { useState } from 'react';

interface UseLoadingOptions {
  minDuration?: number; // in milliseconds, default 0
}

export function useLoading(options: UseLoadingOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Loading...');
  const { minDuration = 0 } = options;

  /**
   * Show loading screen for a specific duration
   * @param duration Duration in seconds (e.g., 2 for 2 seconds)
   * @param message Optional loading message
   */
  const showLoading = (duration: number, message: string = 'Loading...') => {
    setLoadingMessage(message);
    setIsLoading(true);
    
    setTimeout(() => {
      setIsLoading(false);
    }, duration * 1000);
  };

  /**
   * Execute an async function with minimum loading duration
   * @param fn Async function to execute
   * @param minSeconds Minimum duration in seconds
   * @param message Optional loading message
   */
  const withLoading = async <T,>(
    fn: () => Promise<T>,
    minSeconds: number = minDuration / 1000,
    message: string = 'Loading...'
  ): Promise<T> => {
    setLoadingMessage(message);
    setIsLoading(true);
    const startTime = Date.now();

    try {
      const result = await fn();
      
      // Ensure minimum duration
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minSeconds * 1000 - elapsedTime);
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
      
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Manually start loading
   */
  const startLoading = (message: string = 'Loading...') => {
    setLoadingMessage(message);
    setIsLoading(true);
  };

  /**
   * Manually stop loading
   */
  const stopLoading = () => setIsLoading(false);

  return {
    isLoading,
    loadingMessage,
    showLoading,
    withLoading,
    startLoading,
    stopLoading,
  };
}
