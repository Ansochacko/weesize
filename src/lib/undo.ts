export interface History<T> {
  readonly length: number;
  push(value: T): void;
  undo(): T | undefined;
  clear(): void;
}

export function createHistory<T>(limit = 50): History<T> {
  const stack: T[] = [];
  return {
    get length() {
      return stack.length;
    },
    push(value: T) {
      stack.push(value);
      if (stack.length > limit) stack.shift();
    },
    undo() {
      return stack.pop();
    },
    clear() {
      stack.length = 0;
    },
  };
}
