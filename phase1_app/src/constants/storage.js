export const STORAGE_KEYS = {
  favouriteDevotions: "shekinah.phase1.favouriteDevotions",
  notificationPreferences: "shekinah.phase1.notificationPreferences",
  appLanguage: "shekinah.phase1.appLanguage",
  appTheme: "shekinah.phase1.appTheme"
};

export const DEFAULT_APP_LANGUAGE = "en";
export const DEFAULT_APP_THEME = "dark";

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
