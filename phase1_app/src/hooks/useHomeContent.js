import { useCallback, useEffect, useState } from "react";

import { getHomeContent } from "../api/contentApi";
import { DATA } from "../content";

const EMPTY_LIVE = {
  isLive: false,
  title: "",
  viewers: "",
  nextService: "",
  youtubeId: ""
};

const LOCAL_FALLBACK = {
  ...DATA,
  live: {
    ...EMPTY_LIVE,
    nextService: DATA.live?.nextService || ""
  }
};

function normalizeHomeContent(payload) {
  if (!payload || typeof payload !== "object") {
    return LOCAL_FALLBACK;
  }

  return {
    scripture: payload.scripture || DATA.scripture,
    live: payload.live && typeof payload.live === "object" ? { ...EMPTY_LIVE, ...payload.live } : EMPTY_LIVE,
    devotions: Array.isArray(payload.devotions) ? payload.devotions : DATA.devotions,
    sermons: Array.isArray(payload.sermons) ? payload.sermons : DATA.sermons,
    categories: Array.isArray(payload.categories) ? payload.categories : DATA.categories,
    clips: Array.isArray(payload.clips) ? payload.clips : DATA.clips,
    events: Array.isArray(payload.events) ? payload.events : DATA.events,
    branches: Array.isArray(payload.branches) ? payload.branches : DATA.branches,
    updates: Array.isArray(payload.updates) ? payload.updates : DATA.updates,
    platforms: payload.platforms && typeof payload.platforms === "object" ? payload.platforms : DATA.platforms,
    downloads: Array.isArray(payload.downloads) ? payload.downloads : DATA.downloads,
    prayers: Array.isArray(payload.prayers) ? payload.prayers : DATA.prayers,
    about: payload.about || DATA.about
  };
}

export function useHomeContent({ enabled = false } = {}) {
  const [data, setData] = useState(LOCAL_FALLBACK);
  const [source, setSource] = useState("local");
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setData(LOCAL_FALLBACK);
      setSource("local");
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = await getHomeContent();
      setData(normalizeHomeContent(payload));
      setSource("api");
    } catch (err) {
      console.warn("Unable to refresh home content", err);
      setData(LOCAL_FALLBACK);
      setSource("local");
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    let mounted = true;

    async function run() {
        if (!enabled) {
          if (!mounted) return;
        setData(LOCAL_FALLBACK);
        setSource("local");
        setLoading(false);
        setError(null);
        return;
      }

      if (!mounted) return;
      setLoading(true);
      setError(null);

      try {
        const payload = await getHomeContent();

        if (!mounted) return;

        setData(normalizeHomeContent(payload));
        setSource("api");
      } catch (err) {
        if (!mounted) return;

        console.warn("Unable to refresh home content", err);
        setData(LOCAL_FALLBACK);
        setSource("local");
        setError(err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      mounted = false;
    };
  }, [enabled]);

  return {
    data,
    source,
    loading,
    error,
    reload: load
  };
}
