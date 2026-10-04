export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
export function startLogin() {
  window.dispatchEvent(new Event("civicfix:sign-in"));
}
