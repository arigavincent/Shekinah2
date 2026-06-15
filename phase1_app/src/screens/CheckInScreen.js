import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from "react-native";
import * as Clipboard from "expo-clipboard";

import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { C } from "../constants/theme";
import { getMyCheckInCode, listMyCheckInHistory } from "../api/checkinApi";
import { s } from "../styles/appStyles";

export function CheckInScreen({ go, openDrawer, appLanguage = "en" }) {
  const [payload, setPayload] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await getMyCheckInCode();
      setPayload(response || null);
      const historyResponse = await listMyCheckInHistory().catch(() => ({ checkins: [] }));
      setHistory(Array.isArray(historyResponse?.checkins) ? historyResponse.checkins : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to prepare your check-in code.";
      if (/sign in/i.test(message) || /authorization/i.test(message)) {
        Alert.alert("Sign In Required", "Sign in first to open your member QR check-in code.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open Profile", onPress: () => go("Profile") }
        ]);
        return;
      }

      Alert.alert("QR Check-In", message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const qrUrl = useMemo(() => {
    if (!payload?.code) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(payload.code)}`;
  }, [payload?.code]);

  async function copyCode() {
    if (!payload?.code) return;
    await Clipboard.setStringAsync(payload.code);
    Alert.alert("Copied", "Your check-in code is now on the clipboard.");
  }

  return (
    <Screen>
      <TopBar title="QR Check-In" go={go} onMenu={openDrawer} appLanguage={appLanguage} />

      <ScrollView
        contentContainerStyle={s.scrollPad}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={C.gold}
            colors={[C.gold]}
            progressBackgroundColor={C.surface2}
          />
        }
      >
        <View style={s.plainCard}>
          <Text style={[s.rowTitle, { color: C.white }]}>Member Event Check-In</Text>
          <Text style={[s.mutedText, { color: C.muted }]}>
            Present this QR code at church events so the welcome team can check you in.
          </Text>
        </View>

        {loading ? (
          <View style={s.plainCard}>
            <Text style={[s.mutedText, { color: C.muted }]}>Preparing your code...</Text>
          </View>
        ) : payload?.code ? (
          <View style={[s.plainCard, { alignItems: "center" }]}>
            <Text style={[s.rowTitle, { color: C.white }]}>{payload.displayName || "Member"}</Text>
            <Text style={[s.goldSmall, { marginTop: 8, letterSpacing: 2 }]}>{payload.code}</Text>

            {qrUrl ? (
              <Image
                source={{ uri: qrUrl }}
                style={{ width: 280, height: 280, borderRadius: 8, marginTop: 18, backgroundColor: "#fff" }}
              />
            ) : null}

            <Pressable style={s.primaryBtn} onPress={copyCode}>
              <Text style={s.primaryText}>Copy Check-In Code</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.plainCard}>
            <Text style={[s.rowTitle, { color: C.white }]}>Code unavailable</Text>
            <Text style={[s.mutedText, { color: C.muted }]}>
              Sign in first and refresh this screen to generate your code.
            </Text>
          </View>
        )}

        <View style={[s.sectionHeader, { marginTop: 28 }]}>
          <Text style={s.sectionTitle}>My Check-In History</Text>
        </View>

        {history.length === 0 ? (
          <View style={s.plainCard}>
            <Text style={[s.mutedText, { color: C.muted }]}>
              Your recent event attendance will appear here after staff verify your QR code.
            </Text>
          </View>
        ) : (
          history.map(item => (
            <View key={item.id} style={s.plainCard}>
              <Text style={[s.rowTitle, { color: C.white }]}>{item.eventTitle}</Text>
              <Text style={[s.goldSmall, { marginTop: 6 }]}>{item.eventDate}</Text>
              <Text style={[s.mutedText, { color: C.muted, marginTop: 6 }]}>
                Checked in {new Date(item.createdAt).toLocaleString()}
              </Text>
              {item.notes ? <Text style={s.detailBody}>{item.notes}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
