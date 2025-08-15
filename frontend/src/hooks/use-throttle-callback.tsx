import { useCallback, useEffect, useRef } from "react";

type Args<T> = T extends any[] ? T : T[];
type ThrottleFunction<T, P> = (...args: Args<T>) => P;
type ThrottleProps<T, P> = { cb: ThrottleFunction<T, P>; delay?: number };

export function useThrottleCallback<T, P>(props: {
  cb: ThrottleFunction<T, P>;
  delay?: number;
}): ThrottleFunction<T, P>;

// Throttling is a technique used to control how many times we allow a function to be executed over time. When a JavaScript function is said to be throttled with a wait time of X milliseconds, it can only be invoked at most once every X milliseconds. The callback is invoked immediately and cannot be invoked again for the rest of the wait duration.

export function useThrottleCallback<T, P>({
  cb,
  delay = 300,
}: ThrottleProps<T, P>) {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isThrolledRef = useRef(false);

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);

  const throlledFunc = useCallback(
    (...args: Args<T>) => {
      if (!isThrolledRef.current) {
        cb(...args);
        isThrolledRef.current = true;

        timeoutRef.current = setTimeout(() => {
          isThrolledRef.current = false;
        }, delay);
      }
    },
    [delay, cb]
  );

  return throlledFunc;
}

export default useThrottleCallback;
