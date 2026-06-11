import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { C } from "../constants/theme";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { Tabs } from "../components/Tabs";
import {
  getGivingTransaction,
  startCardGiving,
  startMpesaGiving
} from "../api/givingApi";
import {
  clearGivingHistory,
  listGivingHistory,
  saveGivingHistory,
  upsertGivingTransaction
} from "../services/givingHistory";

const CATEGORIES = ["Tithe", "Offering", "Thanksgiving", "Project", "Special Seed"];
const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000, 10000];
const METHODS = ["M-Pesa", "Card"];

function normalizePhone(value) {
  return String(value || "").replace(/[\s-]+/g, "");
}

function normalizeAmount(value) {
  const cleaned = String(value || "").replace(/[^\d]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

function formatKes(value) {
  const amount = Number(value || 0);
  return `KES ${amount.toLocaleString()}`;
}

function statusLabel(status) {
  if (status === "success") return "Paid";
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  return "Pending";
}

function statusColor(status) {
  if (status === "success") return "#4ade80";
  if (status === "failed" || status === "cancelled") return C.red;
  return C.gold;
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString();
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable
      style={[
        s.compactChipBtn,
        active && s.activeChip,
        {
          borderWidth: 1,
          borderColor: active ? C.gold : C.line
        }
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          s.compactChipText,
          {
            color: active ? C.black : C.white
          }
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function GivingTransactionCard({ item, onRefresh, refreshing }) {
  const color = statusColor(item.status);

  return (
    <View style={s.plainCard}>
      <View style={s.rowTight}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: "rgba(212, 175, 55, 0.14)",
            borderWidth: 1,
            borderColor: color,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Ionicons name="heart-outline" size={20} color={color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[s.rowTitle, { color: C.white }]}>
            {formatKes(item.amount)} · {item.category}
          </Text>

          <Text style={[s.mutedText, { color: C.muted }]}>
            {item.phone} · {formatDate(item.createdAt)}
          </Text>

          <Text style={[s.goldSmall, { color }]}>
            {statusLabel(item.status)}
            {item.mpesaReceiptNumber ? ` · ${item.mpesaReceiptNumber}` : ""}
          </Text>
        </View>
      </View>

      {item.resultDescription ? (
        <Text style={[s.mutedText, { color: C.muted, marginTop: 10 }]}>
          {item.resultDescription}
        </Text>
      ) : null}

      {item.note ? (
        <Text style={[s.mutedText, { color: C.white, marginTop: 10 }]}>
          Note: {item.note}
        </Text>
      ) : null}

      <Pressable
        style={[s.secondaryBtn, { marginTop: 12 }]}
        onPress={onRefresh}
        disabled={refreshing}
      >
        <Ionicons name="shield-checkmark-outline" size={18} color={C.gold} />
        <Text style={[s.secondaryText, { color: C.gold }]}>
          {refreshing ? "Checking..." : "Check Status"}
        </Text>
      </Pressable>
    </View>
  );
}

export function GivingScreen({ go, tab, setTab, appLanguage = "en" }) {
  const [method, setMethod] = useState("M-Pesa");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [category, setCategory] = useState("Tithe");
  const [note, setNote] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingId, setRefreshingId] = useState("");
  const [historyRefreshing, setHistoryRefreshing] = useState(false);

  const cleanAmount = useMemo(() => normalizeAmount(amount), [amount]);

  useEffect(() => {
    listGivingHistory().then(setTransactions);
  }, []);

  function validate() {
    if (!cleanAmount || cleanAmount <= 0) {
      return "Enter a valid amount greater than zero.";
    }

    if (cleanAmount > 250000) {
      return "Amount exceeds supported M-Pesa limit.";
    }

    if (method === "M-Pesa") {
      const cleanPhone = normalizePhone(phone);
      if (!/^(?:\+254|254|0)?[17]\d{8}$/.test(cleanPhone)) {
        return "Use a valid Kenyan M-Pesa number, for example 0712345678 or +254712345678.";
      }
    }

    if (method === "Card") {
      if (!String(fullName || "").trim()) {
        return "Enter the card payer's full name.";
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim())) {
        return "Enter a valid email address for the card checkout.";
      }
    }

    return "";
  }

  async function submitGiving() {
    const validationError = validate();

    if (validationError) {
      Alert.alert("Check Giving Form", validationError);
      return;
    }

    setSubmitting(true);

    try {
      const response =
        method === "M-Pesa"
          ? await startMpesaGiving({
              category,
              phone: normalizePhone(phone),
              amount: cleanAmount,
              note: note.trim()
            })
          : await startCardGiving({
              category,
              amount: cleanAmount,
              phone: normalizePhone(phone),
              email: email.trim().toLowerCase(),
              name: fullName.trim(),
              note: note.trim()
            });

      const transaction = response?.transaction;

      if (!transaction?.id) {
        throw new Error("Invalid giving response from server.");
      }

      await upsertGivingTransaction(transaction);

      const next = await listGivingHistory();
      setTransactions(next);

      setAmount("");
      setNote("");
      if (method === "Card") {
        setEmail("");
        setFullName("");
      }
      setTab("Give History");

      if (method === "M-Pesa") {
        Alert.alert(
          "M-Pesa Request Sent",
          "Check your phone and enter your M-Pesa PIN to complete the giving transaction."
        );
      } else {
        if (transaction.checkoutUrl) {
          await Linking.openURL(transaction.checkoutUrl);
        }

        Alert.alert(
          "Card Checkout Ready",
          "A secure card checkout page has been opened. Complete the payment there, then refresh Giving History."
        );
      }
    } catch (error) {
      Alert.alert(
        "Giving Failed",
        error instanceof Error ? error.message : "Unable to start the giving flow."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshTransaction(id) {
    setRefreshingId(id);

    try {
      const response = await getGivingTransaction(id);
      const transaction = response?.transaction;

      if (!transaction?.id) {
        throw new Error("Invalid transaction response.");
      }

      await upsertGivingTransaction(transaction);

      const next = await listGivingHistory();
      setTransactions(next);
    } catch (error) {
      Alert.alert(
        "Status Check Failed",
        error instanceof Error ? error.message : "Unable to check transaction status."
      );
    } finally {
      setRefreshingId("");
    }
  }

  async function refreshAll() {
    setHistoryRefreshing(true);
    const current = await listGivingHistory();
    const next = [];

    try {
      for (const item of current) {
        try {
          const response = await getGivingTransaction(item.id);
          next.push(response.transaction || item);
        } catch {
          next.push(item);
        }
      }

      await saveGivingHistory(next);
      setTransactions(next);
    } finally {
      setHistoryRefreshing(false);
    }
  }

  async function clearHistory() {
    Alert.alert(
      "Clear Local History",
      "This only clears transaction history from this device. It does not delete backend records.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearGivingHistory();
            setTransactions([]);
          }
        }
      ]
    );
  }

  return (
    <Screen>
      <TopBar
        title="Giving"
        go={go}
        back="Home"
      />

      <Tabs tabs={["Give Now", "Give History"]} active={tab} setActive={setTab} />

      <ScrollView
        contentContainerStyle={s.scrollPad}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          tab === "Give History" ? (
            <RefreshControl
              refreshing={historyRefreshing}
              onRefresh={refreshAll}
              tintColor={C.gold}
              colors={[C.gold]}
              progressBackgroundColor={C.surface2}
            />
          ) : undefined
        }
      >
        {tab === "Give Now" ? (
          <>
            <View style={s.plainCard}>
              <Text style={[s.goldSmall, { color: C.gold }]}>
                {method === "M-Pesa" ? "M-Pesa Giving" : "Visa / Mastercard"}
              </Text>
              <Text style={[s.detailTitle, { color: C.white }]}>
                Give to Shekinah Sons Global
              </Text>
              <Text style={[s.mutedText, { color: C.muted }]}>
                {method === "M-Pesa"
                  ? "An STK push will be sent to your phone. Enter your M-Pesa PIN to complete."
                  : "Card giving opens a secure hosted checkout. Complete the payment and return to refresh history."}
              </Text>
            </View>

            <Text style={[s.sectionTitle, { marginBottom: 8 }]}>Payment Method</Text>

            <View style={s.tabsCompact}>
              {METHODS.map(item => (
                <Chip key={item} label={item} active={method === item} onPress={() => setMethod(item)} />
              ))}
            </View>

            <Text style={[s.sectionTitle, { marginBottom: 8 }]}>Giving Type</Text>

            <View style={s.tabsCompact}>
              {CATEGORIES.map(item => (
                <Chip
                  key={item}
                  label={item}
                  active={category === item}
                  onPress={() => setCategory(item)}
                />
              ))}
            </View>

            <Text style={s.inputLabel}>Amount</Text>
            <TextInput
              style={[
                s.searchInput,
                {
                  color: C.white,
                  fontWeight: "900",
                  fontSize: 16
                }
              ]}
              placeholder="Amount in KES"
              placeholderTextColor={C.muted}
              selectionColor={C.gold}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <View style={s.tabsCompact}>
              {QUICK_AMOUNTS.map(item => (
                <Chip
                  key={item}
                  label={formatKes(item)}
                  active={cleanAmount === item}
                  onPress={() => setAmount(String(item))}
                />
              ))}
            </View>

            <Text style={s.inputLabel}>{method === "M-Pesa" ? "M-Pesa Phone Number" : "Phone Number"}</Text>
            <TextInput
              style={[
                s.searchInput,
                {
                  color: C.white,
                  fontWeight: "900",
                  fontSize: 16
                }
              ]}
              placeholder="0712345678"
              placeholderTextColor={C.muted}
              selectionColor={C.gold}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            {method === "Card" ? (
              <>
                <Text style={s.inputLabel}>Full Name</Text>
                <TextInput
                  style={[s.searchInput, { color: C.white, fontWeight: "800" }]}
                  placeholder="Card payer full name"
                  placeholderTextColor={C.muted}
                  selectionColor={C.gold}
                  value={fullName}
                  onChangeText={setFullName}
                />

                <Text style={s.inputLabel}>Email Address</Text>
                <TextInput
                  style={[s.searchInput, { color: C.white, fontWeight: "800" }]}
                  placeholder="name@example.com"
                  placeholderTextColor={C.muted}
                  selectionColor={C.gold}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </>
            ) : null}

            <Text style={s.inputLabel}>Optional Note</Text>
            <TextInput
              style={[
                s.searchInput,
                {
                  minHeight: 90,
                  textAlignVertical: "top",
                  paddingTop: 12,
                  color: C.white,
                  fontWeight: "800",
                  fontSize: 15
                }
              ]}
              placeholder="Example: Thanksgiving seed, building project..."
              placeholderTextColor={C.muted}
              selectionColor={C.gold}
              multiline
              value={note}
              onChangeText={setNote}
            />

            <View style={s.formNote}>
              <Ionicons name="information-circle-outline" size={20} color={C.gold} />
              <Text style={s.formNoteText}>
                {method === "M-Pesa"
                  ? "If Daraja credentials are not configured yet, the app will show the backend configuration error."
                  : "Card giving uses a hosted checkout flow. In local development, the backend can open a mock sandbox page if live provider keys are not configured."}
              </Text>
            </View>

            <Pressable
              style={[s.primaryBtn, submitting && { opacity: 0.65 }]}
              onPress={submitGiving}
              disabled={submitting}
            >
              <Text style={s.primaryText}>
                {submitting
                  ? method === "M-Pesa"
                    ? "Sending STK Push..."
                    : "Opening Checkout..."
                  : method === "M-Pesa"
                    ? "Give with M-Pesa"
                    : "Pay with Card"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={s.plainCard}>
              <Text style={[s.rowTitle, { color: C.white }]}>Giving History</Text>
              <Text style={[s.mutedText, { color: C.muted }]}>
                Shows transactions started from this device.
              </Text>
            </View>

            {transactions.length === 0 ? (
              <View style={s.plainCard}>
                <Text style={[s.rowTitle, { color: C.white }]}>No giving history</Text>
                <Text style={[s.mutedText, { color: C.muted }]}>
                  Start a giving transaction from the Give Now tab.
                </Text>
              </View>
            ) : (
              transactions.map(item => (
                <GivingTransactionCard
                  key={item.id}
                  item={item}
                  refreshing={refreshingId === item.id}
                  onRefresh={() => refreshTransaction(item.id)}
                />
              ))
            )}

            {transactions.length > 0 ? (
              <Pressable style={s.primaryBtn} onPress={clearHistory}>
                <Text style={s.primaryText}>Clear Local History</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
