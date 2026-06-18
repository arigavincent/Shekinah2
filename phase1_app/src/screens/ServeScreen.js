import React, { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import * as Print from "expo-print";
import { Ionicons } from "@expo/vector-icons";

import { C } from "../constants/theme";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { getServeSettings } from "../api/serveSettingsApi";
import { uploadServeRequestPdf } from "../api/serveRequestPdfApi";

const MINISTRIES = [
  {
    name: "Worship",
    icon: "musical-notes-outline",
    description: "Serve through praise, worship, vocals, and instruments."
  },
  {
    name: "Media",
    icon: "videocam-outline",
    description: "Support cameras, sound, livestream, photography, and visuals."
  },
  {
    name: "Ushering",
    icon: "people-outline",
    description: "Welcome people, guide seating, and support service order."
  },
  {
    name: "Children",
    icon: "happy-outline",
    description: "Serve children with care, teaching, and safe supervision."
  },
  {
    name: "Youth",
    icon: "flame-outline",
    description: "Disciple and support the youth ministry."
  },
  {
    name: "Prayer",
    icon: "heart-outline",
    description: "Stand in intercession and prayer support."
  },
  {
    name: "Outreach",
    icon: "megaphone-outline",
    description: "Reach communities through evangelism and missions."
  },
  {
    name: "Hospitality",
    icon: "cafe-outline",
    description: "Serve guests, members, and ministry teams with excellence."
  }
];

function normalizePhone(value) {
  return value.replace(/\s+/g, "");
}

function normalizeWhatsAppNumber(value) {
  const digits = String(value || "").replace(/\D+/g, "");

  if (digits.startsWith("0") && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }

  if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) {
    return `254${digits}`;
  }

  return digits;
}

function ministryByName(name) {
  return MINISTRIES.find(item => item.name === name);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildServeRequestPdfHtml(cleaned, selectedMinistry) {
  const fullName = `${cleaned.firstName} ${cleaned.lastName}`.trim();
  const submittedAt = new Date().toLocaleString();

  const row = (label, value) => value
    ? `<tr><td class="label">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`
    : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page {
      margin: 28px;
    }

    body {
      margin: 0;
      padding: 0;
      background: #fbf6e8;
      color: #2b2110;
      font-family: Helvetica, Arial, sans-serif;
    }

    .card {
      border: 2px solid #b8860b;
      border-radius: 22px;
      overflow: hidden;
      background: #fffdf6;
      box-shadow: 0 10px 30px rgba(43, 33, 16, 0.16);
    }

    .header {
      background: #050505;
      color: #f2efe8;
      padding: 28px 30px;
      border-bottom: 5px solid #d9a21b;
    }

    .eyebrow {
      color: #d9a21b;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin: 0 0 8px;
    }

    h1 {
      margin: 0;
      font-size: 30px;
      line-height: 1.15;
    }

    .subtitle {
      margin-top: 8px;
      color: #d8c391;
      font-size: 14px;
    }

    .section {
      padding: 22px 30px;
      border-bottom: 1px solid #ead9ad;
    }

    .section:last-child {
      border-bottom: 0;
    }

    h2 {
      margin: 0 0 12px;
      font-size: 16px;
      color: #7a5708;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    td {
      padding: 10px 0;
      vertical-align: top;
      border-bottom: 1px solid #f1e3bd;
      font-size: 14px;
    }

    tr:last-child td {
      border-bottom: 0;
    }

    .label {
      width: 34%;
      color: #776846;
      font-weight: 800;
    }

    .ministry-box {
      background: #fbf0cf;
      border: 1px solid #d8c391;
      border-radius: 16px;
      padding: 16px;
      font-size: 14px;
      line-height: 1.55;
    }

    .footer {
      background: #f3e8cf;
      padding: 16px 30px;
      color: #776846;
      font-size: 12px;
    }

    .stamp {
      display: inline-block;
      background: #b8860b;
      color: #fffdf6;
      padding: 7px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      margin-top: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <p class="eyebrow">Shekinah Sons Global Church</p>
      <h1>Serve Request</h1>
      <div class="subtitle">A member has requested to join a serving team.</div>
      <div class="stamp">Pending Review</div>
    </div>

    <div class="section">
      <h2>Member Details</h2>
      <table>
        ${row("Name", fullName)}
        ${row("Phone", cleaned.phoneNumber)}
        ${row("Email", cleaned.email)}
        ${row("Date of Birth", cleaned.dateOfBirth)}
      </table>
    </div>

    <div class="section">
      <h2>Location</h2>
      <table>
        ${row("City", cleaned.city)}
        ${row("Country", cleaned.country)}
      </table>
    </div>

    <div class="section">
      <h2>Ministry Interest</h2>
      <div class="ministry-box">
        <strong>${escapeHtml(cleaned.ministryInterest)}</strong><br />
        ${escapeHtml(selectedMinistry?.description || "No ministry notes provided.")}
      </div>
    </div>

    <div class="footer">
      Submitted from the Shekinah Sons Global Church App<br />
      ${escapeHtml(submittedAt)}
    </div>
  </div>
</body>
</html>`;
}

async function createServeRequestPdf(cleaned, selectedMinistry) {
  const html = buildServeRequestPdfHtml(cleaned, selectedMinistry);
  const result = await Print.printToFileAsync({
    html,
    width: 612,
    height: 792
  });

  if (!result?.uri) {
    throw new Error("The PDF could not be created.");
  }

  return result.uri;
}


function MinistryCard({ ministry, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.plainCard,
        {
          borderColor: active ? C.gold : C.line,
          backgroundColor: active ? C.goldSoft : C.surface
        }
      ]}
    >
      <View style={s.rowTight}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: active ? C.gold : C.surface2
          }}
        >
          <Ionicons
            name={active ? "checkmark" : ministry.icon}
            size={21}
            color={active ? C.black : C.gold}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[s.rowTitle, { color: C.white }]}>{ministry.name}</Text>
          <Text style={[s.mutedText, { color: C.muted }]}>{ministry.description}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function ServeScreen({ go, appLanguage = "en" }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    email: "",
    dateOfBirth: "",
    city: "",
    country: "Kenya",
    ministryInterest: ""
  });
  function updateField(key, value) {
    setForm(current => ({
      ...current,
      [key]: value
    }));
  }

  function validate(cleaned) {
    const requiredFields = [
      ["firstName", "First name"],
      ["lastName", "Last name"],
      ["phoneNumber", "Phone number"],
      ["email", "Email"],
      ["city", "City"],
      ["country", "Country"],
      ["ministryInterest", "Ministry interest"]
    ];

    const missing = requiredFields.find(([key]) => !cleaned[key]);

    if (missing) {
      return `${missing[1]} is required.`;
    }

    if (!/^(?:\+254|254|0)?[17]\d{8}$/.test(cleaned.phoneNumber)) {
      return "Use a valid Kenyan phone number, for example 0712345678 or +254712345678.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned.email)) {
      return "Enter a valid email address.";
    }

    return "";
  }

  async function submitServeForm() {
    const cleaned = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phoneNumber: normalizePhone(form.phoneNumber),
      email: form.email.trim(),
      dateOfBirth: form.dateOfBirth.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      ministryInterest: form.ministryInterest.trim()
    };

    const validationError = validate(cleaned);

    if (validationError) {
      Alert.alert("Check Form", validationError);
      return;
    }

    const selectedMinistry = ministryByName(cleaned.ministryInterest);

    try {
      const pdfUri = await createServeRequestPdf(cleaned, selectedMinistry);
      const uploadResponse = await uploadServeRequestPdf(pdfUri);
      const pdfUrl = uploadResponse?.pdf?.url || "";

      if (!pdfUrl) {
        throw new Error("The PDF was created but the public link was not returned.");
      }

      const settingsResponse = await getServeSettings();
      const authorityNumber = normalizeWhatsAppNumber(settingsResponse?.serve?.whatsappNumber || "");

      if (!authorityNumber) {
        Alert.alert(
          "Serve Contact Missing",
          "The church has not configured the WhatsApp contact for serve requests yet."
        );
        return;
      }

      const whatsappMessage = [
        "🟨 *SERVE REQUEST*",
        "*Shekinah Sons Global Church*",
        "",
        `Name: ${cleaned.firstName} ${cleaned.lastName}`,
        `Phone: ${cleaned.phoneNumber}`,
        `Email: ${cleaned.email}`,
        cleaned.dateOfBirth ? `Date of Birth: ${cleaned.dateOfBirth}` : "",
        `Location: ${cleaned.city}, ${cleaned.country}`,
        `Ministry Interest: ${cleaned.ministryInterest}`,
        "",
        "📄 *Styled PDF:*",
        pdfUrl
      ]
        .filter(Boolean)
        .join("\n");

      await Linking.openURL(`https://wa.me/${authorityNumber}?text=${encodeURIComponent(whatsappMessage)}`);

      setForm({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        email: "",
        dateOfBirth: "",
        city: "",
        country: "Kenya",
        ministryInterest: ""
      });
    } catch (error) {
      Alert.alert(
        "Unable To Send Serve Request",
        error instanceof Error ? error.message : "Please try again."
      );
    }
  }

  return (
    <Screen>
      <TopBar title="Serve" go={go} back="Home" appLanguage={appLanguage} />

      <ScrollView
        contentContainerStyle={s.scrollPad}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={s.serveHero}>
          <View style={s.serveIcon}>
            <Ionicons name="hand-left-outline" size={30} color={C.black} />
          </View>

          <View style={s.serveHeroText}>
            <Text style={s.serveTitle}>Join A Serving Team</Text>
            <Text style={s.serveSubtitle}>
              Use your gifts to build the house and serve people with excellence.
            </Text>
          </View>
        </View>

        <View style={s.formSection}>
          <Text style={s.formSectionTitle}>Choose A Ministry</Text>
          <Text style={s.formHelp}>
            Select where you would like to serve.
          </Text>

          {MINISTRIES.map(ministry => (
            <MinistryCard
              key={ministry.name}
              ministry={ministry}
              active={form.ministryInterest === ministry.name}
              onPress={() => updateField("ministryInterest", ministry.name)}
            />
          ))}
        </View>

        <View style={s.formSection}>
          <Text style={s.formSectionTitle}>Personal Details</Text>

          <View style={s.formRow}>
            <View style={s.formHalf}>
              <Text style={s.inputLabel}>First Name</Text>
              <TextInput
                style={s.formInput}
                placeholder="Vincent"
                placeholderTextColor={C.faint}
                value={form.firstName}
                onChangeText={value => updateField("firstName", value)}
              />
            </View>

            <View style={s.formHalf}>
              <Text style={s.inputLabel}>Last Name</Text>
              <TextInput
                style={s.formInput}
                placeholder="Ariga"
                placeholderTextColor={C.faint}
                value={form.lastName}
                onChangeText={value => updateField("lastName", value)}
              />
            </View>
          </View>

          <Text style={s.inputLabel}>Phone Number</Text>
          <TextInput
            style={s.formInput}
            placeholder="0712345678"
            placeholderTextColor={C.faint}
            keyboardType="phone-pad"
            value={form.phoneNumber}
            onChangeText={value => updateField("phoneNumber", value)}
          />

          <Text style={s.inputLabel}>Email Address</Text>
          <TextInput
            style={s.formInput}
            placeholder="name@example.com"
            placeholderTextColor={C.faint}
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.email}
            onChangeText={value => updateField("email", value)}
          />

          <Text style={s.inputLabel}>Date of Birth</Text>
          <TextInput
            style={s.formInput}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={C.faint}
            value={form.dateOfBirth}
            onChangeText={value => updateField("dateOfBirth", value)}
          />
        </View>

        <View style={s.formSection}>
          <Text style={s.formSectionTitle}>Location</Text>

          <Text style={s.inputLabel}>City</Text>
          <TextInput
            style={s.formInput}
            placeholder="Nairobi"
            placeholderTextColor={C.faint}
            value={form.city}
            onChangeText={value => updateField("city", value)}
          />

          <Text style={s.inputLabel}>Country</Text>
          <TextInput
            style={s.formInput}
            placeholder="Kenya"
            placeholderTextColor={C.faint}
            value={form.country}
            onChangeText={value => updateField("country", value)}
          />
        </View>

        <View style={s.formNote}>
          <Ionicons name="information-circle-outline" size={20} color={C.gold} />
          <Text style={s.formNoteText}>
            Submitting creates a styled PDF, uploads it securely, and opens WhatsApp to the responsible leader. Review it, then tap Send.
          </Text>
        </View>

        <Pressable style={s.primaryBtn} onPress={submitServeForm}>
          <Text style={s.primaryText}>Create Serve Request PDF</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
