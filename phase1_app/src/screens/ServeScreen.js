import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { C } from "../constants/theme";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";

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

function ministryByName(name) {
  return MINISTRIES.find(item => item.name === name);
}

function MinistryCard({ ministry, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.plainCard,
        {
          borderColor: active ? C.gold : C.line,
          backgroundColor: active ? "rgba(212, 175, 55, 0.12)" : C.surface
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

export function ServeScreen({ go }) {
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

    const message = [
      "Serve Request - Shekinah Sons Global",
      "",
      `Name: ${cleaned.firstName} ${cleaned.lastName}`,
      `Phone: ${cleaned.phoneNumber}`,
      `Email: ${cleaned.email}`,
      cleaned.dateOfBirth ? `Date of Birth: ${cleaned.dateOfBirth}` : "",
      `Location: ${cleaned.city}, ${cleaned.country}`,
      `Ministry Interest: ${cleaned.ministryInterest}`,
      selectedMinistry ? `Ministry Notes: ${selectedMinistry.description}` : ""
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await Share.share({ message });

      Alert.alert(
        "Serve Request Ready",
        "Your request has been prepared. Send it through your preferred app."
      );

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
    } catch {
      Alert.alert("Unable To Share", "Please try again.");
    }
  }

  return (
    <Screen>
      <TopBar title="Serve" go={go} back="Home" />

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
            Submitting opens your phone share menu with a prepared serve request.
          </Text>
        </View>

        <Pressable style={s.primaryBtn} onPress={submitServeForm}>
          <Text style={s.primaryText}>Submit Serve Request</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
