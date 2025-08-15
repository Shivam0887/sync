import { useState } from "react";
import useDebounceCallback from "./use-debounce-callback";

interface IOptions {
  leading?: boolean;
  trailing?: boolean;
}

export function useDebounceValue<T>(
  initialValue: T | (() => T),
  delay?: number,
  options?: IOptions
): [T, React.Dispatch<React.SetStateAction<T>>];

export function useDebounceValue<T>(
  initialValue: T | (() => T),
  options?: IOptions
): [T, React.Dispatch<React.SetStateAction<T>>];

export function useDebounceValue<T>(
  initialValue: T | (() => T),
  delay?: number | IOptions,
  options?: IOptions
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const unwrappedInitialValue =
    initialValue instanceof Function ? initialValue() : initialValue;

  const wait = typeof delay === "number" ? delay : 300;

  const [debounceValue, setDebounceValue] = useState(unwrappedInitialValue);

  const setValue = useDebounceCallback(setDebounceValue, wait, options);

  return [debounceValue, setValue];
}

export default useDebounceValue;
