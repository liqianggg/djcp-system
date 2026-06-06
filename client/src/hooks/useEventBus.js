import { useEffect, useCallback } from 'react';

// 全局事件总线 —— 跨组件数据同步
const listeners = new Map();

function subscribe(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

function emit(event, ...args) {
  const fns = listeners.get(event);
  if (fns) fns.forEach(fn => fn(...args));
}

export { emit };

export default function useEventBus(event, handler) {
  const stableHandler = useCallback(handler, [handler]);

  useEffect(() => {
    if (!event || !handler) return;
    return subscribe(event, stableHandler);
  }, [event, stableHandler]);
}
