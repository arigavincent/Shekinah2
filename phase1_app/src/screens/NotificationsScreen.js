import React, { useMemo } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { C } from "../constants/theme";
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_ITEMS
} from "../constants/storage";
import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { Setting } from "../components/Setting";
import {
  registerForPushNotifications,
  scheduleLocalTestNotification,
  syncPushPreferences
} from "../services/pushNotifications";

function enabledCount(preferences) {
  return NOTIFICATION_ITEMS.reduce(
    (total, item) => total + (preferences[item.key] ? 1 : 0),
    0
  );
}

function NotificationSummary({ preferences, appLanguage }) {
  const count = enabledCount(preferences);
  const total = NOTIFICATION_ITEMS.length;
  const allEnabled = count === total;

  return (
    <View style={s.plainCard}>
      <View style={s.rowTight}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: allEnabled ? C.gold : C.goldSoft,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: C.gold
          }}
        >
          <Ionicons
            name={allEnabled ? "notifications" : "notifications-outline"}
            size={22}
            color={allEnabled ? C.black : C.gold}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Notification Preferences")}</Text>
          <Text style={[s.mutedText, { color: C.muted }]}>
            {count} of {total} enabled
          </Text>
          <Text style={[s.goldSmall, { color: C.gold }]}>
            {tr(appLanguage, "Device preferences are ready")}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ActionCard({ icon, title, text, onPress }) {
  return (
    <Pressable style={s.plainCard} onPress={onPress}>
      <View style={s.rowTight}>
        <Ionicons name={icon} size={22} color={C.gold} />

        <View style={{ flex: 1 }}>
          <Text style={[s.rowTitle, { color: C.white }]}>{title}</Text>
          <Text style={[s.mutedText, { color: C.muted }]}>{text}</Text>
        </View>

        <Ionicons name="chevron-forward" size={19} color={C.muted} />
      </View>
    </Pressable>
  );
}

export function NotificationsScreen({ go, preferences, setPreferences, appLanguage = "en" }) {
  const count = useMemo(() => enabledCount(preferences), [preferences]);
  const allEnabled = count === NOTIFICATION_ITEMS.length;

  function togglePreference(key) {
    setPreferences(current => {
      const next = {
        ...current,
        [key]: !current[key]
      };

      syncPushPreferences(next).catch(() => {});

      return next;
    });
  }

  function enableAll() {
    setPreferences(() => {
      const next = {};

      for (const item of NOTIFICATION_ITEMS) {
        next[item.key] = true;
      }

      syncPushPreferences(next).catch(() => {});

      return next;
    });
  }

  function disableAll() {
    setPreferences(() => {
      const next = {};

      for (const item of NOTIFICATION_ITEMS) {
        next[item.key] = false;
      }

      syncPushPreferences(next, false).catch(() => {});

      return next;
    });
  }

  function resetDefaults() {
    const next = { ...DEFAULT_NOTIFICATION_PREFS };
    setPreferences(next);
    syncPushPreferences(next).catch(() => {});
  }

  async function requestPushPermission() {
    try {
      const token = await registerForPushNotifications(preferences);

      Alert.alert(
        "Push Notifications Enabled",
        `This device is registered for push notifications.\n\n${token.slice(0, 28)}...`
      );
    } catch (error) {
      Alert.alert(
        tr(appLanguage, "Push Registration Failed"),
        error instanceof Error ? error.message : "Unable to register this device."
      );
    }
  }

  async function sendLocalTestNotification() {
    try {
      await scheduleLocalTestNotification({
        title: "Live Service Alert",
        body: "Tap this alert to open the Live screen.",
        screen: "Live"
      });

      Alert.alert(
        "Local Notification Scheduled",
        "A test notification will appear in about one second. Tap it to open the Live screen."
      );
    } catch (error) {
      Alert.alert(
        tr(appLanguage, "Local Test Failed"),
        error instanceof Error ? error.message : "Unable to schedule a local notification."
      );
    }
  }

  function openDeviceSettings() {
    Linking.openSettings().catch(() => {
      Alert.alert(tr(appLanguage, "Settings unavailable"), tr(appLanguage, "Open your phone settings manually."));
    });
  }

  return (
    <Screen>
      <TopBar title="Notifications" go={go} back="Home" appLanguage={appLanguage} />

      <ScrollView contentContainerStyle={s.scrollPad}>
        <NotificationSummary preferences={preferences} appLanguage={appLanguage} />

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
          <Pressable
            style={[
              s.secondaryBtn,
              {
                flex: 1,
                borderColor: C.gold,
                backgroundColor: allEnabled ? C.goldSoft : C.surface
              }
            ]}
            onPress={enableAll}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={C.gold} />
            <Text style={[s.secondaryText, { color: C.gold }]}>{tr(appLanguage, "Enable All")}</Text>
          </Pressable>

          <Pressable
            style={[s.secondaryBtn, { flex: 1 }]}
            onPress={disableAll}
          >
            <Ionicons name="close-circle-outline" size={18} color={C.gold} />
            <Text style={[s.secondaryText, { color: C.gold }]}>{tr(appLanguage, "Disable All")}</Text>
          </Pressable>
        </View>

        <ActionCard
          icon="notifications-outline"
          title={tr(appLanguage, "Register Remote Push")}
          text={tr(appLanguage, "Enable notifications to receive church updates, service reminders, and important announcements on this device.")}
          onPress={requestPushPermission}
        />

        <ActionCard
          icon="flash-outline"
          title={tr(appLanguage, "Send Local Test")}
          text={tr(appLanguage, "Works in Expo Go on Android. Tapping the notification should open the Live screen.")}
          onPress={sendLocalTestNotification}
        />

        <ActionCard
          icon="settings-outline"
          title={tr(appLanguage, "Open Device Settings")}
          text={tr(appLanguage, "Manage Android notification permissions for this app.")}
          onPress={openDeviceSettings}
        />

        <Text style={[s.sectionTitle, { marginTop: 12 }]}>{tr(appLanguage, "Alert Types")}</Text>

        {NOTIFICATION_ITEMS.map(item => (
          <Setting
            key={item.key}
            label={tr(appLanguage, item.label)}
            value={preferences[item.key] ? tr(appLanguage, "Enabled") : tr(appLanguage, "Disabled")}
            onPress={() => togglePreference(item.key)}
          />
        ))}

        <Pressable style={s.primaryBtn} onPress={resetDefaults}>
          <Text style={s.primaryText}>{tr(appLanguage, "Reset Defaults")}</Text>
        </Pressable>

        <View style={s.formNote}>
          <Ionicons name="information-circle-outline" size={20} color={C.gold} />
          <Text style={s.formNoteText}>
            {tr(appLanguage, "Expo Go on Android can test local notifications, but remote push registration and admin broadcasts require a development build or release app.")}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
