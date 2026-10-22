import { useEffect, useSyncExternalStore, type AnchorHTMLAttributes } from "react";
import "./navigation.css";
const navigationEvent = "chess:navigate";
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener("hashchange", listener);
  window.addEventListener(navigationEvent, listener);
  return () => { window.removeEventListener("popstate", listener); window.removeEventListener("hashchange", listener); window.removeEventListener(navigationEvent, listener); };
}
export function useRouteLocation() {
  const value = useSyncExternalStore(subscribe, () => location.pathname + location.search + location.hash);
  return new URL(value, location.origin);
}
export function navigateRoute(href: string, replace = false) {
  const next = new URL(href, location.href);
  if (next.origin !== location.origin) throw new Error("Internal navigation must stay on this site.");
  const value = next.pathname + next.search + next.hash;
  if (value === location.pathname + location.search + location.hash) return;
  if (!replace) window.history.replaceState({ ...window.history.state, chessScroll: { x: window.scrollX, y: window.scrollY } }, "", location.href);
  window.history[replace ? "replaceState" : "pushState"](replace ? window.history.state : null, "", value);
  window.dispatchEvent(new Event(navigationEvent));
}
export function updateRouteQuery(changes: Record<string, string | number | null>, replace = false) {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  navigateRoute(url.pathname + url.search, replace);
}
export function RouteLink({ href = "", onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target || props.download) return;
    const target = new URL(href, location.href);
    const section = location.pathname.split("/")[1];
    if (target.origin === location.origin && target.pathname.split("/")[1] === section) {
      event.preventDefault(); navigateRoute(href);
    }
  }} />;
}
export function usePageNavigation(title: string, pathname: string) {
  useEffect(() => { document.title = title; }, [title]);
  useEffect(() => {
    const request = requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("main h1");
      if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
      const saved = window.history.state?.chessScroll;
      window.scrollTo(saved?.x ?? 0, saved?.y ?? 0);
    });
    return () => cancelAnimationFrame(request);
  }, [pathname]);
}
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return <nav className="chess-breadcrumbs" aria-label="Breadcrumb"><ol>{items.map((item, index) => <li key={`${index}:${item.label}`}>{item.href && index < items.length - 1 ? <RouteLink href={item.href}>{item.label}</RouteLink> : <span aria-current="page">{item.label}</span>}</li>)}</ol></nav>;
}
export function MissingPage({ title = "This page isn’t available", children, href, label, embedded = false }: { title?: string; children: React.ReactNode; href: string; label: string; embedded?: boolean }) {
  const Container = embedded ? "section" : "main";
  return <Container className="chess-missing"><h1>{title}</h1><p>{children}</p><RouteLink href={href}>{label} →</RouteLink></Container>;
}
