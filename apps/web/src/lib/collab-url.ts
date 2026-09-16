/** Same-origin collab WS (nginx `/collab` → Hocuspocus). Local Vite proxies `/collab` too. */
export function collabWebSocketUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/collab`;
}
