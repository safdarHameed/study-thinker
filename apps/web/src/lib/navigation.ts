/** Full page navigation: drops all in-memory state (used after the account is deleted). */
export function hardNavigate(url: string) {
  window.location.replace(url);
}
