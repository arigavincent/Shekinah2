import { useEffect, useState } from "react";

import {
  getPlaybackProgressMap,
  subscribePlaybackProgress
} from "../services/playbackProgressStore";

export function usePlaybackProgressMap() {
  const [progressMap, setProgressMap] = useState({});

  useEffect(() => {
    let mounted = true;

    getPlaybackProgressMap()
      .then(value => {
        if (mounted) {
          setProgressMap(value || {});
        }
      })
      .catch(() => {
        if (mounted) {
          setProgressMap({});
        }
      });

    const unsubscribe = subscribePlaybackProgress(value => {
      if (mounted) {
        setProgressMap(value || {});
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return progressMap;
}
