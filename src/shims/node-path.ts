export function dirname(value: string): string {
  const index = value.lastIndexOf("/");
  return index >= 0 ? value.slice(0, index) : ".";
}
