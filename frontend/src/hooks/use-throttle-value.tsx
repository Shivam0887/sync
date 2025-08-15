import { useState } from "react";
import useThrottleCallback from "./use-throttle-callback";

export function useThrottleValue<T>(
  initialValue: T | (() => T),
  delay: number = 300
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const unwrappedInitialValue =
    initialValue instanceof Function ? initialValue() : initialValue;

  const [throlledValue, setThrottledValue] = useState(unwrappedInitialValue);

  const setValue = useThrottleCallback({
    delay,
    cb: setThrottledValue,
  });

  return [throlledValue, setValue];
}

export default useThrottleValue;
