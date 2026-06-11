import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  registerNotificationDevice,
  updateNotificationPreferences
} from "../api/notificationsApi";

const PUSH_TOKEN_KEY = "shekinah.push.expoToken";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

function projectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    ""
  );
}

function isExpoGoAndroid() {
  return Constants.appOwnership === "expo" && Platform.OS === "android";
}

async function ensureNotificationPermissions() {
  if (!Device.isDevice) {
    throw new Error("Notifications require a physical device.");
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#D4AF37"
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== "granted") {
    throw new Error("Notification permission was not granted.");
  }
}

export async function getStoredExpoPushToken() {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

export async function clearStoredExpoPushToken() {
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}

export async function registerForPushNotifications(preferences) {
  await ensureNotificationPermissions();

  if (isExpoGoAndroid()) {
    throw new Error(
      "Remote push notifications are not available in Expo Go on Android. Test local notifications in Expo Go, or use a development build for real push registration."
    );
  }

  const id = projectId();

  const tokenResponse = id
    ? await Notifications.getExpoPushTokenAsync({ projectId: id })
    : await Notifications.getExpoPushTokenAsync();

  const expoPushToken = tokenResponse.data;

  await registerNotificationDevice({
    expoPushToken,
    platform: Platform.OS,
    deviceName: Device.deviceName || "",
    appVersion: Constants?.expoConfig?.version || "",
    preferences
  });

  await AsyncStorage.setItem(PUSH_TOKEN_KEY, expoPushToken);

  return expoPushToken;
}

export async function scheduleLocalTestNotification({
  title = "Shekinah Sons Global",
  body = "This is a local notification test from Expo Go.",
  screen = "Live"
} = {}) {
  await ensureNotificationPermissions();

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        screen
      }
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1
    }
  });

  return {
    mode: isExpoGoAndroid() ? "local-expo-go" : "local-device"
  };
}

export async function syncPushPreferences(preferences, enabled = true) {
  const expoPushToken = await getStoredExpoPushToken();

  if (!expoPushToken) return null;

  await updateNotificationPreferences({
    expoPushToken,
    preferences,
    enabled
  });

  return expoPushToken;
}
