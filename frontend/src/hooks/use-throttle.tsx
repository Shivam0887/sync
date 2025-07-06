import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ThrottleFunction<T> = (args: T) => void;

type ThrottleProps<T> =
  | { isFunc: true; cb: ThrottleFunction<T>; delay?: number }
  | { isFunc: false; value: T; delay?: number };

export function useThrottle<T, P>(props: {
  isFunc: true;
  cb: (args: T) => P;
  delay?: number;
}): (args: T) => P;

export function useThrottle<T>(props: {
  isFunc: false;
  value: T;
  delay?: number;
}): T | null;

export function useThrottle<T>({ delay = 300, ...props }: ThrottleProps<T>) {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isThrolledRef = useRef(false);

  const [throlledValue, setThrottledValue] = useState<T | null>(null);

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);

  const cachedProps = useMemo(() => props, [props]);

  const throlledFunc = useCallback(
    (args: T) => {
      if (!isThrolledRef.current && cachedProps.isFunc) {
        cachedProps.cb(args);
        isThrolledRef.current = true;

        timeoutRef.current = setTimeout(() => {
          isThrolledRef.current = false;
        }, delay);
      }
    },
    [delay, cachedProps]
  );

  if (!isThrolledRef.current && !cachedProps.isFunc) {
    setThrottledValue(cachedProps.value);

    timeoutRef.current = setTimeout(() => {
      isThrolledRef.current = true;
    }, delay);
  }

  return cachedProps.isFunc ? throlledFunc : throlledValue;
}

export default useThrottle;
