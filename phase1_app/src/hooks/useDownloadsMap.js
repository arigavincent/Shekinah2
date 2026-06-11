import { useEffect, useMemo, useState } from "react";

import {
  listDownloads,
  subscribeDownloads
} from "../services/downloadsStore";

export function useDownloadsMap() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mounted = true;

    listDownloads()
      .then(value => {
        if (mounted) {
          setItems(Array.isArray(value) ? value : []);
        }
      })
      .catch(() => {
        if (mounted) {
          setItems([]);
        }
      });

    const unsubscribe = subscribeDownloads(value => {
      if (mounted) {
        setItems(Array.isArray(value) ? value : []);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const bySermonId = useMemo(() => {
    return items.reduce((acc, item) => {
      const sermonId = item?.sermon?.id || item?.sermonId;
      if (sermonId) {
        acc[sermonId] = item;
      }
      return acc;
    }, {});
  }, [items]);

  const byDownloadId = useMemo(() => {
    return items.reduce((acc, item) => {
      if (item?.id) {
        acc[item.id] = item;
      }
      return acc;
    }, {});
  }, [items]);

  return {
    items,
    bySermonId,
    byDownloadId
  };
}
