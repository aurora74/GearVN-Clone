import * as React from "react";
import throttle from "lodash.throttle";

import { useUnmount } from "./use-unmount";

interface ThrottleSettings {
  leading?: boolean | undefined;
  trailing?: boolean | undefined;
}

const defaultOptions: ThrottleSettings = {
  leading: false,
  trailing: true,
};

export function useThrottledCallback<T extends (...args: any[]) => any>(
  fn: T,
  wait = 250,
  options: ThrottleSettings = defaultOptions
): {
  (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T>;
  cancel: () => void;
  flush: () => void;
} {
  const handler = React.useMemo(
    () => throttle<T>(fn, wait, options),
    [fn, options, wait]
  );

  useUnmount(() => {
    handler.cancel();
  });

  return handler;
}

export default useThrottledCallback;
