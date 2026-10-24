/** Local identifiers only; also works on the HTTP development preview. */
export function demoId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
}
