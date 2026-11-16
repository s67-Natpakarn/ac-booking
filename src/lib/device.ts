// Check input capabilities rather than screen width or browser identity.
// any-pointer also covers tablets with a connected mouse or trackpad.
export function hasTouchInput(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(any-pointer: coarse)").matches;
}
