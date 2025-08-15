import { useCallback, useEffect, useMemo, useRef } from "react";

interface IOptions {
  leading?: boolean;
  trailing?: boolean;
}

type Args<T> = T extends any[] ? T : T[];

const useDebounceCallback = <T, P>(
  cb: (...args: Args<T>) => P,
  delay = 300,
  options?: IOptions
) => {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isFirstEventRef = useRef(true);

  const cachedOptions = useMemo(
    () => ({
      leading: options?.leading ?? false,
      trailing: options?.trailing ?? true,
    }),
    [options]
  );

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);

  const debounceFunc = useCallback(
    (...args: Args<T>) => {
      clearTimeout(timeoutRef.current);
      if (cachedOptions.leading && isFirstEventRef.current) {
        cb(...args);
      }
      isFirstEventRef.current = false;

      timeoutRef.current = setTimeout(() => {
        isFirstEventRef.current = true;
        if (cachedOptions.trailing) {
          cb(...args);
        }
      }, delay);
    },
    [delay, cb, cachedOptions.leading, cachedOptions.trailing]
  );

  return debounceFunc;
};

export default useDebounceCallback;
