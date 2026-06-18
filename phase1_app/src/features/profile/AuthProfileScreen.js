import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  loadSavedSession,
  loginAndSaveSession,
  logoutSession,
  registerAndSaveSession
} from "../auth/authSession";
import { API_CONFIG } from "../../config/apiConfig";
import { APP_LANGUAGES, tr } from "../../i18n/labels";
import { C, makeThemedStyles, THEME_OPTIONS, THEME_PALETTE_OPTIONS, useAppTheme } from "../../constants/theme";

export function AuthProfileScreen({
  go,
  appLanguage = "en",
  setAppLanguage,
  appTheme,
  setAppTheme,
  appThemePalette,
  setAppThemePalette,
  initialSession,
  onSessionChange
}) {
  const [mode, setMode] = useState("Login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(initialSession || { token: null, user: null });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const signedIn = Boolean(session.user && session.token);

  function applySession(nextSession) {
    setSession(nextSession);
    if (typeof onSessionChange === "function") {
      onSessionChange(nextSession);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        const saved = await loadSavedSession();

        if (!mounted) return;

        applySession(saved);
      } catch {
        if (!mounted) return;

        applySession({ token: null, user: null });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    boot();

    return () => {
      mounted = false;
    };
  }, []);

  const submitAuth = async () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (mode === "Register" && cleanName.length < 2) {
      Alert.alert(tr(appLanguage, "Check Form"), tr(appLanguage, "Full name is required."));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      Alert.alert(tr(appLanguage, "Check Form"), tr(appLanguage, "Enter a valid email address."));
      return;
    }

    if (password.length < 8) {
      Alert.alert(tr(appLanguage, "Check Form"), tr(appLanguage, "Password must be at least 8 characters."));
      return;
    }

    setSubmitting(true);

    try {
      const result =
        mode === "Register"
          ? await registerAndSaveSession({ name: cleanName, email: cleanEmail, password })
          : await loginAndSaveSession({ email: cleanEmail, password });

      applySession(result);
    } catch (error) {
      Alert.alert(tr(appLanguage, "Auth Failed"), error?.message || tr(appLanguage, "Unable to authenticate."));
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    setSubmitting(true);

    try {
      await logoutSession();
      applySession({ token: null, user: null });
    } catch (error) {
      Alert.alert(tr(appLanguage, "Logout Failed"), error?.message || tr(appLanguage, "Unable to logout."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={s.screen}>
        <Top go={go} appLanguage={appLanguage} />
        <View style={s.center}>
          <ActivityIndicator color={C.gold} />
          <Text style={s.muted}>{tr(appLanguage, "Loading session...")}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Top go={go} appLanguage={appLanguage} />

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={s.apiCard}>
          <Text style={s.apiLabel}>API</Text>
          <Text style={s.apiText}>{API_CONFIG.baseUrl}</Text>
        </View>

        <LanguageCard
          appLanguage={appLanguage}
          setAppLanguage={setAppLanguage}
        />

        <ThemeCard
          appLanguage={appLanguage}
          appTheme={appTheme}
          setAppTheme={setAppTheme}
          appThemePalette={appThemePalette}
          setAppThemePalette={setAppThemePalette}
          signedIn={signedIn}
        />

        {signedIn ? (
          <SignedInView
            user={session.user}
            go={go}
            logout={logout}
            submitting={submitting}
            appLanguage={appLanguage}
          />
        ) : (
          <SignedOutView
            mode={mode}
            setMode={setMode}
            name={name}
            setName={setName}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            submitAuth={submitAuth}
            submitting={submitting}
            appLanguage={appLanguage}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Top({ go, appLanguage = "en" }) {
  return (
    <View style={s.topBar}>
      <Pressable style={s.iconBtn} onPress={() => go("Home")}>
        <Ionicons name="chevron-back-outline" size={24} color={C.white} />
      </Pressable>

      <View style={s.titleWrap}>
        <Text style={s.title}>{tr(appLanguage, "Profile")}</Text>
        <Text style={s.subtitle}>{tr(appLanguage, "Account and member access")}</Text>
      </View>

      <View style={s.iconBtn} />
    </View>
  );
}

function LanguageCard({ appLanguage, setAppLanguage }) {
  return (
    <View style={s.card}>
      <Text style={s.sectionTitle}>{tr(appLanguage, "Language Preference")}</Text>
      <Text style={s.noteText}>{tr(appLanguage, "Choose how the app labels and buttons appear.")}</Text>

      <View style={[s.modeRow, { marginTop: 14, marginBottom: 0 }]}>
        {APP_LANGUAGES.map(item => (
          <Pressable
            key={item.key}
            style={[s.modeBtn, appLanguage === item.key && s.modeActive]}
            onPress={() => setAppLanguage?.(item.key)}
          >
            <Text style={[s.modeText, appLanguage === item.key && s.modeTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ThemeCard({
  appLanguage,
  appTheme,
  setAppTheme,
  signedIn
}) {
  if (!signedIn) {
    return (
      <View style={s.card}>
        <Text style={s.sectionTitle}>{tr(appLanguage, "Appearance")}</Text>
        <Text style={s.noteText}>
          {tr(appLanguage, "Sign in to save your preferred appearance.")}
        </Text>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <Text style={s.sectionTitle}>{tr(appLanguage, "Appearance")}</Text>
      <Text style={s.noteText}>
        {tr(appLanguage, "Memorial Gold theme with warm light mode and royal dark mode.")}
      </Text>

      <Text style={[s.inputLabel, { marginTop: 16 }]}>{tr(appLanguage, "Mode")}</Text>
      <View style={[s.modeRow, { marginTop: 8, marginBottom: 0 }]}>
        {THEME_OPTIONS.map(item => (
          <Pressable
            key={item.key}
            style={[s.modeBtn, appTheme === item.key && s.modeActive]}
            onPress={() => setAppTheme?.(item.key)}
          >
            <Text style={[s.modeText, appTheme === item.key && s.modeTextActive]}>
              {tr(appLanguage, item.label)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SignedOutView({
  mode,
  setMode,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  submitAuth,
  submitting,
  appLanguage
}) {
  return (
    <>
      <View style={s.hero}>
        <View style={s.avatar}>
          <Ionicons name="person-outline" size={36} color={C.gold} />
        </View>

        <Text style={s.heroTitle}>{tr(appLanguage, "Welcome")}</Text>
        <Text style={s.heroText}>
          {tr(appLanguage, "Sign in to access saved devotions, giving history, prayer requests, and member features.")}
        </Text>
      </View>

      <View style={s.modeRow}>
        {["Login", "Register"].map(item => (
          <Pressable
            key={item}
            style={[s.modeBtn, mode === item && s.modeActive]}
            onPress={() => setMode(item)}
          >
            <Text style={[s.modeText, mode === item && s.modeTextActive]}>
              {tr(appLanguage, item)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>{tr(appLanguage, mode)}</Text>

        {mode === "Register" ? (
          <>
            <Text style={s.inputLabel}>{tr(appLanguage, "Full Name")}</Text>
            <TextInput
              style={s.input}
              placeholder={tr(appLanguage, "Full Name")}
              placeholderTextColor={C.faint}
              value={name}
              onChangeText={setName}
            />
          </>
        ) : null}

        <Text style={s.inputLabel}>{tr(appLanguage, "Email")}</Text>
        <TextInput
          style={s.input}
          placeholder="name@example.com"
          placeholderTextColor={C.faint}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={s.inputLabel}>{tr(appLanguage, "Password")}</Text>
        <TextInput
          style={s.input}
          placeholder={tr(appLanguage, "Minimum 8 characters")}
          placeholderTextColor={C.faint}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable style={s.primaryBtn} onPress={submitAuth} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={C.black} />
          ) : (
            <Text style={s.primaryText}>{tr(appLanguage, mode)}</Text>
          )}
        </Pressable>
      </View>

    </>
  );
}

function SignedInView({ user, go, logout, submitting, appLanguage }) {
  return (
    <>
      <View style={s.profileCard}>
        <View style={s.avatarLarge}>
          <Text style={s.avatarText}>{user.name?.charAt(0)?.toUpperCase() || "U"}</Text>
        </View>

        <Text style={s.profileName}>{user.name}</Text>
        <Text style={s.profileEmail}>{user.email}</Text>

        <View style={s.rolePill}>
          <Text style={s.roleText}>{user.role}</Text>
        </View>
      </View>

      <View style={s.stats}>
        <Stat label={tr(appLanguage, "Sermons")} value="12" />
        <Stat label={tr(appLanguage, "Devotions")} value="8" />
        <Stat label={tr(appLanguage, "Given")} value={tr(appLanguage, "Hidden")} />
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>{tr(appLanguage, "Account")}</Text>
        <Info label="User ID" value={user.id} />
        <Info label={tr(appLanguage, "Role")} value={user.role} />
        <Info label={tr(appLanguage, "Active")} value={String(user.isActive)} />
        <Info label={tr(appLanguage, "Created")} value={user.createdAt} />
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>{tr(appLanguage, "Quick Access")}</Text>

        <MenuRow label={tr(appLanguage, "My Downloads")} onPress={() => go("Downloads")} />
        <MenuRow label={tr(appLanguage, "Saved Devotions")} onPress={() => go("Devotions")} />
        <MenuRow label={tr(appLanguage, "Giving History")} onPress={() => go("Giving")} />
        <MenuRow label={tr(appLanguage, "My Prayer Requests")} onPress={() => go("Prayer")} />
        <MenuRow label={tr(appLanguage, "Notification Settings")} onPress={() => go("Notifications")} />
      </View>

      <Pressable style={s.logoutBtn} onPress={logout} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={C.red} />
        ) : (
          <Text style={s.logoutText}>{tr(appLanguage, "Logout")}</Text>
        )}
      </Pressable>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.muted}>{label}</Text>
    </View>
  );
}

function Info({ label, value }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

function MenuRow({ label, onPress }) {
  return (
    <Pressable style={s.menuRow} onPress={onPress}>
      <Text style={s.menuText}>{label}</Text>
      <Ionicons name="chevron-forward-outline" size={18} color={C.muted} />
    </Pressable>
  );
}

const s = makeThemedStyles(C => ({
  screen: {
    flex: 1,
    backgroundColor: C.background,
    paddingBottom: 76
  },
  topBar: {
    minHeight: 86,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.background
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center"
  },
  iconSpacer: {
    width: 48
  },
  titleWrap: {
    flex: 1,
    alignItems: "center"
  },
  title: { fontFamily: C.fontDisplay,
    color: C.white,
    fontSize: 18,
    fontWeight: "900"
  },
  subtitle: { fontFamily: C.fontBody, fontFamily: C.fontDisplay,
    color: C.muted,
    fontSize: 12,
    marginTop: 4
  },
  content: {
    padding: 16,
    paddingBottom: 120
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  apiCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.line
  },
  apiLabel: { fontFamily: C.fontBold,
    color: C.gold,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 4
  },
  apiText: {
    color: C.muted,
    fontSize: 12
  },
  hero: {
    backgroundColor: C.blue,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    marginBottom: 16
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.backgroundElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  heroTitle: { fontFamily: C.fontDisplay,
    color: C.textOnBrand,
    fontSize: 24,
    fontWeight: "900"
  },
  heroText: { fontFamily: C.fontBody,
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8
  },
  modeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14
  },
  modeBtn: {
    flex: 1,
    backgroundColor: C.surface2,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.line
  },
  modeActive: {
    backgroundColor: C.gold,
    borderColor: C.gold
  },
  modeText: { fontFamily: C.fontBold,
    color: C.white,
    fontWeight: "900"
  },
  modeTextActive: {
    color: C.textOnAccent
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 14
  },
  sectionTitle: { fontFamily: C.fontDisplay,
    color: C.white,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 14
  },
  inputLabel: {
    color: C.white,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 7
  },
  input: {
    backgroundColor: C.surface2,
    color: C.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.line
  },
  primaryBtn: {
    backgroundColor: C.gold,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4
  },
  primaryText: { fontFamily: C.fontBold,
    color: C.textOnAccent,
    fontSize: 14,
    fontWeight: "900"
  },
  note: {
    backgroundColor: C.surface2,
    borderRadius: 12,
    padding: 14
  },
  noteText: { fontFamily: C.fontBody,
    color: C.muted,
    fontSize: 13,
    lineHeight: 19
  },
  profileCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 16
  },
  avatarLarge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: C.blue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14
  },
  avatarText: {
    color: C.gold,
    fontSize: 36,
    fontWeight: "900"
  },
  profileName: { fontFamily: C.fontDisplay,
    color: C.white,
    fontSize: 24,
    fontWeight: "900"
  },
  profileEmail: { fontFamily: C.fontBody,
    color: C.muted,
    marginTop: 5
  },
  rolePill: {
    backgroundColor: C.gold,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 14
  },
  roleText: { fontFamily: C.fontBold,
    color: C.textOnAccent,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12
  },
  stats: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16
  },
  statBox: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.line
  },
  statValue: { fontFamily: C.fontDisplay,
    color: C.white,
    fontSize: 18,
    fontWeight: "900"
  },
  muted: { fontFamily: C.fontBody,
    color: C.muted,
    fontSize: 13,
    lineHeight: 19
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.line
  },
  infoLabel: { fontFamily: C.fontBody,
    color: C.muted,
    fontSize: 13
  },
  infoValue: { fontFamily: C.fontBody,
    flex: 1,
    color: C.white,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right"
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.line
  },
  menuText: { fontFamily: C.fontBody,
    color: C.white,
    fontSize: 15,
    fontWeight: "800"
  },
  logoutBtn: {
    backgroundColor: "rgba(241,59,59,0.12)",
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.red
  },
  logoutText: { fontFamily: C.fontBold,
    color: C.red,
    fontWeight: "900"
  }
}));
