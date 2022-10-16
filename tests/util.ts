export function debug<T>(x: T): T {
  console.log("debug: ", x);
  return x;
}
