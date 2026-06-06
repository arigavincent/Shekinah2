export const STORAGE_KEYS = {
  favouriteDevotions: "shekinah.phase1.favouriteDevotions",
  notificationPreferences: "shekinah.phase1.notificationPreferences"
};

export const DEFAULT_NOTIFICATION_PREFS = {
  newSermons: true,
  newDevotions: true,
  liveServiceAlerts: true,
  upcomingEvents: true,
  newPrayerPoints: true
};

export const NOTIFICATION_ITEMS = [
  { key: "newSermons", label: "New sermons" },
  { key: "newDevotions", label: "New devotions" },
  { key: "liveServiceAlerts", label: "Live service alerts" },
  { key: "upcomingEvents", label: "Upcoming events" },
  { key: "newPrayerPoints", label: "New prayer points" }
];
