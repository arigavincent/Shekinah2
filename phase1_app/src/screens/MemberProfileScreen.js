import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  Text,
  View
} from "react-native";

import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { C } from "../constants/theme";
import {
  createPrivateChatRequest,
  createPrivateChatThread,
  getPrivateChatMemberProfile,
  listPrivateChatThreads
} from "../api/privateChatApi";
import { loadSavedSession } from "../features/profile/authSession";
import { tr } from "../i18n/labels";
import { ensurePrivateChatDevice } from "../services/privateChatCrypto";
import { s } from "../styles/appStyles";

function Stat({ label, value }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.mutedText}>{label}</Text>
    </View>
  );
}

export function MemberProfileScreen({ go, detail, appLanguage = "en" }) {
  const memberId = detail?.memberId || "";
  const initialName = detail?.displayName || "";
  const [session, setSession] = useState({ token: null, user: null });
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const savedSession = await loadSavedSession();
        if (!active) return;
        setSession(savedSession);
        if (!savedSession?.token) {
          setLoading(false);
          return;
        }

        const response = await getPrivateChatMemberProfile(memberId);
        if (active) {
          setMember(response?.member || null);
        }
      } catch (error) {
        if (active) {
          Alert.alert(
            tr(appLanguage, "Member Profile"),
            error instanceof Error ? error.message : tr(appLanguage, "Unable to load member profile.")
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [appLanguage, memberId]);

  async function refreshProfile() {
    const response = await getPrivateChatMemberProfile(memberId);
    setMember(response?.member || null);
  }

  async function openThread() {
    setActing(true);
    try {
      const threadsResponse = await listPrivateChatThreads();
      const existing = Array.isArray(threadsResponse?.threads)
        ? threadsResponse.threads.find(item => item?.id === member?.threadId || item?.peer?.id === memberId)
        : null;

      if (existing) {
        go("PrivateChatThread", { thread: existing });
        return;
      }

      const created = await createPrivateChatThread(memberId);
      if (created?.thread) {
        go("PrivateChatThread", { thread: created.thread });
      }
    } catch (error) {
      Alert.alert(
        tr(appLanguage, "Private Chat"),
        error instanceof Error ? error.message : tr(appLanguage, "Unable to open encrypted thread.")
      );
    } finally {
      setActing(false);
    }
  }

  async function sendRequest() {
    if (!session?.user?.id) {
      Alert.alert(tr(appLanguage, "Sign In Required"), tr(appLanguage, "Sign in first to send a private chat request."));
      return;
    }

    setActing(true);
    try {
      await ensurePrivateChatDevice(session.user.id);
      await createPrivateChatRequest(memberId);
      await refreshProfile();
      Alert.alert(tr(appLanguage, "Request Sent"), tr(appLanguage, "Your private chat request is now waiting for this member to accept."));
    } catch (error) {
      Alert.alert(
        tr(appLanguage, "Private Chat"),
        error instanceof Error ? error.message : tr(appLanguage, "Unable to send private chat request.")
      );
    } finally {
      setActing(false);
    }
  }

  const displayName = member?.displayName || initialName || tr(appLanguage, "Member");

  return (
    <Screen>
      <TopBar title={displayName} go={go} back="Chat" appLanguage={appLanguage} />

      <View style={s.pad}>
        <View style={s.profileHead}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[s.detailTitle, { textAlign: "center" }]}>{displayName}</Text>
          <Text style={[s.mutedText, { color: C.muted, textAlign: "center", marginTop: 8 }]}>
            {loading
              ? tr(appLanguage, "Loading member profile...")
              : member?.isSelf
                ? tr(appLanguage, "This is your public community profile.")
                : tr(appLanguage, "Tap request to ask this member for a private encrypted chat.")}
          </Text>
        </View>

        <View style={s.stats}>
          <Stat label={tr(appLanguage, "Community")} value={String(member?.communityCount || 0)} />
          <Stat label={tr(appLanguage, "Testimonies")} value={String(member?.testimonyCount || 0)} />
        </View>

        <View style={s.plainCard}>
          <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Profile Status")}</Text>
          <Text style={[s.mutedText, { color: C.muted, marginTop: 8 }]}>
            {member?.threadId
              ? tr(appLanguage, "Private chat is already available with this member.")
              : member?.requestStatus === "pending" && member?.requestDirection === "outgoing"
                ? tr(appLanguage, "Your private chat request is pending.")
                : member?.requestStatus === "pending" && member?.requestDirection === "incoming"
                  ? tr(appLanguage, "This member is waiting for you in Private to accept their request.")
                  : member?.hasDevice
                    ? tr(appLanguage, "This member can receive private chat requests.")
                    : tr(appLanguage, "This member has not enabled encrypted chat on their device yet.")}
          </Text>
        </View>

        {session?.user?.id ? (
          member?.isSelf ? null : member?.threadId ? (
            <Pressable style={[s.primaryBtn, acting && { opacity: 0.6 }]} onPress={openThread} disabled={acting}>
              <Text style={s.primaryText}>{tr(appLanguage, "Open Chat")}</Text>
            </Pressable>
          ) : member?.requestStatus === "pending" && member?.requestDirection === "outgoing" ? (
            <View style={s.plainCard}>
              <Text style={[s.goldSmall, { marginTop: 0 }]}>{tr(appLanguage, "Request Pending")}</Text>
            </View>
          ) : member?.requestStatus === "pending" && member?.requestDirection === "incoming" ? (
            <Pressable style={[s.primaryBtn, acting && { opacity: 0.6 }]} onPress={() => go("Chat", { tab: "Private" }, { replace: true })} disabled={acting}>
              <Text style={s.primaryText}>{tr(appLanguage, "Open Private")}</Text>
            </Pressable>
          ) : (
            <Pressable style={[s.primaryBtn, acting && { opacity: 0.6 }]} onPress={sendRequest} disabled={acting}>
              <Text style={s.primaryText}>{acting ? tr(appLanguage, "Sending...") : tr(appLanguage, "Send Chat Request")}</Text>
            </Pressable>
          )
        ) : (
          <Pressable style={s.primaryBtn} onPress={() => go("Profile")}>
            <Text style={s.primaryText}>{tr(appLanguage, "Sign In")}</Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}
