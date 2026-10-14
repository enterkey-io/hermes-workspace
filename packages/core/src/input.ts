/** Prevent whitespace/control characters from changing URL or header parsing. */
export function hasControlOrSpace(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 32 || code === 127) return true;
  }
  return false;
}
