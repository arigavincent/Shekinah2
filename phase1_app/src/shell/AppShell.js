import React, { useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  SafeAreaView,
  StatusBar
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useFonts } from "expo-font";

import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
  Roboto_900Black
} from "@expo-google-fonts/roboto";

import { AuthProfileScreen } from "../features/profile/AuthProfileScreen";
import { loadSavedSession } from "../features/auth/authSession";

import { ContentProvider } from "../providers/ContentProvider";

import { C, setThemeMode, ThemeContext } from "../constants/theme";
import {
  DEFAULT_APP_LANGUAGE,
  DEFAULT_APP_THEME,
  DEFAULT_APP_THEME_PALETTE,
  DEFAULT_NOTIFICATION_PREFS,
  STORAGE_KEYS
} from "../constants/storage";

import { s } from "../styles/appStyles";
import { stopAudioCompletely } from "../services/audioPlayback";

import { BottomNav } from "../components/BottomNav";
import { Drawer } from "../components/Drawer";
import { MiniPlayer } from "../components/MiniPlayer";

import { AboutScreen } from "../screens/AboutScreen";
import { AudioPlayer } from "../screens/AudioPlayer";
import { BibleScreen } from "../screens/BibleScreen";
import { BranchesScreen } from "../screens/BranchesScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { CheckInScreen } from "../screens/CheckInScreen";
import { DevotionDetail } from "../screens/DevotionDetail";
import { DevotionsScreen } from "../screens/DevotionsScreen";
import { DownloadsScreen } from "../screens/DownloadsScreen";
import { EventDetail } from "../screens/EventDetail";
import { EventsScreen } from "../screens/EventsScreen";
import { GivingScreen } from "../screens/GivingScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LiveScreen } from "../screens/LiveScreen";
import { LibraryScreen } from "../screens/LibraryScreen";
import { MemberProfileScreen } from "../screens/MemberProfileScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { PlatformsScreen } from "../screens/PlatformsScreen";
import { PrivateChatThreadScreen } from "../screens/PrivateChatThreadScreen";
import { PrayerScreen } from "../screens/PrayerScreen";
import { ReadingPlansScreen } from "../screens/ReadingPlansScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { SermonsScreen } from "../screens/SermonsScreen";
import { ServeScreen } from "../screens/ServeScreen";
import { TestimoniesScreen } from "../screens/TestimoniesScreen";
import { UpdatesScreen } from "../screens/UpdatesScreen";
import { VideoDetail } from "../screens/VideoDetail";

const NOTIFICATION_SCREENS = new Set([
  "Home",
  "Sermons",
  "Devotions",
  "Live",
  "Events",
  "Prayer",
  "Giving",
  "Branches",
  "Bible",
  "Platforms",
  "Updates",
  "About",
  "Profile",
  "Notifications",
  "Downloads",
  "Library",
  "Chat",
  "Testimonies",
  "ReadingPlans",
  "CheckIn"
]);

function notificationTargetScreen(data) {
  if (!data || typeof data !== "object") return "";

  const rawScreen = typeof data.screen === "string" ? data.screen.trim() : "";
  if (NOTIFICATION_SCREENS.has(rawScreen)) return rawScreen;

  const rawCategory = typeof data.category === "string" ? data.category.trim().toLowerCase() : "";

  switch (rawCategory) {
    case "sermons":
      return "Sermons";
    case "devotions":
      return "Devotions";
    case "live":
      return "Live";
    case "events":
      return "Events";
    case "prayer":
      return "Prayer";
    default:
      return "";
  }
}

function App() {
  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
    Roboto_900Black
  });
  const [screen, setScreen] = useState("Home");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [sermonTab, setSermonTab] = useState("Video");
  const [devotionTab, setDevotionTab] = useState("Latest");
  const [platformTab, setPlatformTab] = useState("Web");
  const [givingTab, setGivingTab] = useState("Give Now");
  const [downloadsTab, setDownloadsTab] = useState("Sermons");
  const [prayerTab, setPrayerTab] = useState("All Prayers");
  const [chatTab, setChatTab] = useState("Community");
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState(DEFAULT_NOTIFICATION_PREFS);
  const [notificationPrefsLoaded, setNotificationPrefsLoaded] = useState(false);
  const [appLanguage, setAppLanguage] = useState(DEFAULT_APP_LANGUAGE);
  const [appLanguageLoaded, setAppLanguageLoaded] = useState(false);
  const [appTheme, setAppTheme] = useState(DEFAULT_APP_THEME);
  const [appThemePalette, setAppThemePalette] = useState(DEFAULT_APP_THEME_PALETTE);
  const [appThemeLoaded, setAppThemeLoaded] = useState(false);
  const [miniPlayer, setMiniPlayer] = useState(null);
  const [authSession, setAuthSession] = useState({ token: null, user: null });

  const themeUserKey = String(authSession?.user?.id || authSession?.user?.email || "").trim();
  const themeModeStorageKey = themeUserKey
    ? `${STORAGE_KEYS.appTheme}:${themeUserKey}`
    : STORAGE_KEYS.appTheme;
  const themePaletteStorageKey = themeUserKey
    ? `${STORAGE_KEYS.appThemePalette}:${themeUserKey}`
    : STORAGE_KEYS.appThemePalette;

useEffect(() => {
  let mounted = true;

  async function loadAuthSession() {
    try {
      const saved = await loadSavedSession();
      if (mounted) setAuthSession(saved);
    } catch {
      if (mounted) setAuthSession({ token: null, user: null });
    }
  }

  loadAuthSession();

  return () => {
    mounted = false;
  };
}, []);

useEffect(() => {
  let mounted = true;

  async function loadFavouriteDevotions() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.favouriteDevotions);

      if (!mounted) return;

      if (!raw) {
        setFavorites([]);
        return;
      }

      const parsed = JSON.parse(raw);
      setFavorites(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.warn("Failed to load favourite devotions", error);

      if (mounted) {
        setFavorites([]);
      }
    } finally {
      if (mounted) {
        setFavoritesLoaded(true);
      }
    }
  }

  loadFavouriteDevotions();

  return () => {
    mounted = false;
  };
}, []);

useEffect(() => {
  let mounted = true;

  async function loadAppAppearance() {
    try {
      const [rawTheme, rawPalette] = await Promise.all([
        AsyncStorage.getItem(themeModeStorageKey),
        AsyncStorage.getItem(themePaletteStorageKey)
      ]);

      if (!mounted) return;

      setAppTheme(rawTheme === "light" ? "light" : DEFAULT_APP_THEME);
      setAppThemePalette(
        DEFAULT_APP_THEME_PALETTE
      );
    } catch (error) {
      console.warn("Failed to load app appearance", error);

      if (mounted) {
        setAppTheme(DEFAULT_APP_THEME);
        setAppThemePalette(DEFAULT_APP_THEME_PALETTE);
      }
    } finally {
      if (mounted) {
        setAppThemeLoaded(true);
      }
    }
  }

  loadAppAppearance();

  return () => {
    mounted = false;
  };
}, [themeModeStorageKey, themePaletteStorageKey]);

useEffect(() => {
  let mounted = true;

  async function loadAppLanguage() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.appLanguage);

      if (!mounted) return;

      setAppLanguage(raw === "sw" ? "sw" : DEFAULT_APP_LANGUAGE);
    } catch (error) {
      console.warn("Failed to load app language", error);

      if (mounted) {
        setAppLanguage(DEFAULT_APP_LANGUAGE);
      }
    } finally {
      if (mounted) {
        setAppLanguageLoaded(true);
      }
    }
  }

  loadAppLanguage();

  return () => {
    mounted = false;
  };
}, []);

useEffect(() => {
  let mounted = true;

  async function loadNotificationPreferences() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.notificationPreferences);

      if (!mounted) return;

      if (!raw) {
        setNotificationPrefs(DEFAULT_NOTIFICATION_PREFS);
        return;
      }

      const parsed = JSON.parse(raw);

      setNotificationPrefs({
        ...DEFAULT_NOTIFICATION_PREFS,
        ...(parsed && typeof parsed === "object" ? parsed : {})
      });
    } catch (error) {
      console.warn("Failed to load notification preferences", error);

      if (mounted) {
        setNotificationPrefs(DEFAULT_NOTIFICATION_PREFS);
      }
    } finally {
      if (mounted) {
        setNotificationPrefsLoaded(true);
      }
    }
  }

  loadNotificationPreferences();

  return () => {
    mounted = false;
  };
}, []);

useEffect(() => {
  if (!notificationPrefsLoaded) return;

  AsyncStorage.setItem(
    STORAGE_KEYS.notificationPreferences,
    JSON.stringify(notificationPrefs)
  ).catch(error => {
    console.warn("Failed to save notification preferences", error);
  });
}, [notificationPrefs, notificationPrefsLoaded]);

useEffect(() => {
  if (!appLanguageLoaded) return;

  AsyncStorage.setItem(STORAGE_KEYS.appLanguage, appLanguage).catch(error => {
    console.warn("Failed to save app language", error);
  });
}, [appLanguage, appLanguageLoaded]);

useEffect(() => {
  if (!appThemeLoaded) return;

  AsyncStorage.multiSet([
    [themeModeStorageKey, appTheme],
    [themePaletteStorageKey, appThemePalette]
  ]).catch(error => {
    console.warn("Failed to save app appearance", error);
  });
}, [appTheme, appThemePalette, appThemeLoaded, themeModeStorageKey, themePaletteStorageKey]);

useEffect(() => {
  setThemeMode(appTheme, appThemePalette);
}, [appTheme, appThemePalette]);


  useEffect(() => {
  if (!favoritesLoaded) return;

  AsyncStorage.setItem(
    STORAGE_KEYS.favouriteDevotions,
    JSON.stringify(favorites)
  ).catch(error => {
    console.warn("Failed to save favourite devotions", error);
  });
}, [favorites, favoritesLoaded]);

  const go = (name, nextDetail = null, options = {}) => {
  if (!options.replace && name !== screen) {
    setHistory(current => [
      ...current,
      {
        screen,
        detail
      }
    ]);
  }

  setScreen(name);
  setDetail(nextDetail);
  setDrawerOpen(false);
};

const openDrawer = () => {
  setDrawerOpen(true);
};

useEffect(() => {
  const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
    if (drawerOpen) {
      setDrawerOpen(false);
      return true;
    }

    if (history.length > 0) {
      const previous = history[history.length - 1];

      setHistory(current => current.slice(0, -1));
      setScreen(previous.screen);
      setDetail(previous.detail);
      return true;
    }

    if (screen !== "Home") {
      setScreen("Home");
      setDetail(null);
      return true;
    }

    return false;
  });

  return () => {
    subscription.remove();
  };
}, [drawerOpen, history, screen]);

useEffect(() => {
  function openFromNotification(data) {
    const target = notificationTargetScreen(data);
    if (!target) return;

    setDrawerOpen(false);
    setDetail(null);
    setScreen(target);
  }

  const lastResponse = Notifications.getLastNotificationResponse();
  if (lastResponse?.notification?.request?.content?.data) {
    openFromNotification(lastResponse.notification.request.content.data);
  }

  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    openFromNotification(response?.notification?.request?.content?.data);
  });

  return () => {
    subscription.remove();
  };
}, []);

  const openSermon = sermon => {
    if (sermon.type === "audio") {
      setMiniPlayer(sermon);
      go("AudioPlayer", sermon);
    } else {
      go("VideoDetail", sermon);
    }
  };

  const renderScreen = () => {
    switch (screen) {
      case "Search":
        return <SearchScreen go={go} openSermon={openSermon} appLanguage={appLanguage} />;
      case "Sermons":
        return (
          <SermonsScreen
            go={go}
            openDrawer={openDrawer}
            openSermon={openSermon}
            tab={sermonTab}
            setTab={setSermonTab}
            appLanguage={appLanguage}
          />
        );
      case "VideoDetail":
        return (
          <VideoDetail
            sermon={detail}
            go={go}
            openSermon={openSermon}
            setDownloadsTab={setDownloadsTab}
            appLanguage={appLanguage}
          />
        );
      case "AudioPlayer":
        return (
          <AudioPlayer
            sermon={detail || miniPlayer}
            go={go}
            setMiniPlayer={setMiniPlayer}
            setDownloadsTab={setDownloadsTab}
            appLanguage={appLanguage}
          />
        );
      case "Devotions":
        return (
          <DevotionsScreen
            go={go}
            openDrawer={openDrawer}
            tab={devotionTab}
            setTab={setDevotionTab}
            favorites={favorites}
            setFavorites={setFavorites}
            appLanguage={appLanguage}
          />
        );
      case "DevotionDetail":
        return <DevotionDetail devotion={detail} favorites={favorites} setFavorites={setFavorites} go={go} appLanguage={appLanguage} />;
      case "Live":
        return <LiveScreen go={go} openDrawer={openDrawer} openSermon={openSermon} appLanguage={appLanguage} />;
      case "Downloads":
        return <DownloadsScreen go={go} tab={downloadsTab} setTab={setDownloadsTab} appLanguage={appLanguage} />;
      case "Chat":
        return <ChatScreen go={go} openDrawer={openDrawer} tab={chatTab} setTab={setChatTab} detail={detail} appLanguage={appLanguage} />;
      case "Library":
        return <LibraryScreen go={go} openDrawer={openDrawer} appLanguage={appLanguage} session={authSession} />;
      case "MemberProfile":
        return <MemberProfileScreen go={go} detail={detail} appLanguage={appLanguage} />;
      case "PrivateChatThread":
        return <PrivateChatThreadScreen go={go} detail={detail} appLanguage={appLanguage} />;
      case "Testimonies":
        return <TestimoniesScreen go={go} openDrawer={openDrawer} appLanguage={appLanguage} />;
      case "Branches":
        return <BranchesScreen go={go} appLanguage={appLanguage} />;
      case "Profile":
        return (
          <AuthProfileScreen
            go={go}
            appLanguage={appLanguage}
            setAppLanguage={setAppLanguage}
            appTheme={appTheme}
            setAppTheme={setAppTheme}
            appThemePalette={appThemePalette}
            setAppThemePalette={setAppThemePalette}
            initialSession={authSession}
            onSessionChange={setAuthSession}
          />
        );
      case "Bible":
        return <BibleScreen go={go} appLanguage={appLanguage} />;
      case "ReadingPlans":
        return <ReadingPlansScreen go={go} openDrawer={openDrawer} appLanguage={appLanguage} />;
      case "CheckIn":
        return <CheckInScreen go={go} openDrawer={openDrawer} appLanguage={appLanguage} />;
      case "Events":
        return <EventsScreen go={go} appLanguage={appLanguage} />;
      case "EventDetail":
        return <EventDetail event={detail} go={go} appLanguage={appLanguage} />;
      case "Giving":
        return <GivingScreen go={go} tab={givingTab} setTab={setGivingTab} appLanguage={appLanguage} />;
      case "Prayer":
        return <PrayerScreen go={go} tab={prayerTab} setTab={setPrayerTab} appLanguage={appLanguage} />;
      case "Updates":
        return <UpdatesScreen go={go} appLanguage={appLanguage} />;
      case "Platforms":
        return <PlatformsScreen go={go} tab={platformTab} setTab={setPlatformTab} appLanguage={appLanguage} />;
      case "Serve":
        return <ServeScreen go={go} appLanguage={appLanguage} />;
      case "Notifications":
        return (
          <NotificationsScreen
            go={go}
            preferences={notificationPrefs}
            setPreferences={setNotificationPrefs}
            appLanguage={appLanguage}
          />
        );
      case "About":
        return <AboutScreen go={go} appLanguage={appLanguage} />;
      default:
        return <HomeScreen go={go} openDrawer={openDrawer} openSermon={openSermon} appLanguage={appLanguage} />;
    }
  };

  const themeContextValue = {
    mode: appTheme,
    palette: appThemePalette,
    setMode: setAppTheme,
    setPalette: setAppThemePalette,
    toggleTheme: () => setAppTheme(current => (current === "light" ? "dark" : "light"))
  };

  const memoizedThemeContextValue = useMemo(
    () => themeContextValue,
    [appTheme, appThemePalette]
  );

  if (!appThemeLoaded || !fontsLoaded) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.background }}>
        <StatusBar barStyle={appTheme === "light" ? "dark-content" : "light-content"} backgroundColor={C.background} />
      </SafeAreaView>
    );
  }

  return (
  <ThemeContext.Provider value={memoizedThemeContextValue}>
  <ContentProvider>
    <SafeAreaView key={appTheme} style={s.app}>
      <StatusBar barStyle={appTheme === "light" ? "dark-content" : "light-content"} backgroundColor={C.background} />
      {renderScreen()}

      {miniPlayer && screen !== "AudioPlayer" ? (
        <MiniPlayer
          item={miniPlayer}
          onOpen={() => go("AudioPlayer", miniPlayer)}
          onClose={async () => {
            await stopAudioCompletely();
            setMiniPlayer(null);
            setDetail(null);
          }}
        />
      ) : null}

      <BottomNav current={screen} go={go} appLanguage={appLanguage} />
      <Drawer visible={drawerOpen} close={() => setDrawerOpen(false)} go={go} appLanguage={appLanguage} />
    </SafeAreaView>
  </ContentProvider>
  </ThemeContext.Provider>
);
}

export default App;
