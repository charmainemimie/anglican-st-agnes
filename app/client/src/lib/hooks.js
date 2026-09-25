// Small data hooks: routing by URL hash, and loading API data.
import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

// Routes look like #/church/<id>. Hash routing works on any static host.
export function useRoute() {
  const parse = () => location.hash.replace(/^#\/?/, "").split("/");
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
export const go = (path) => { location.hash = "#/" + path; };

// Load data from a GET endpoint; call reload() after a change
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: await api(path), error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
