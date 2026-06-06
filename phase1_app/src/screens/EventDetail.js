import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Share,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { PHASE1_IMAGES } from "../content";
import { C } from "../constants/theme";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { EmptyState } from "../components/Cards";
import { resolveMediaUrl } from "../utils/mediaUrl";

function eventImage(event) {
  return resolveMediaUrl(event?.imageUrl || event?.image || "") || PHASE1_IMAGES.event;
}

function eventDate(event) {
  return event?.date || event?.eventDate || "";
}

function eventTime(event) {
  return event?.time || event?.eventTime || "";
}

export function EventDetail({ event, go }) {
  if (!event) {
    return (
      <Screen>
        <TopBar title="Event" go={go} back="Events" />
        <EmptyState title="No Event Selected" text="Choose an event first." />
      </Screen>
    );
  }

  async function shareEvent() {
    await Share.share({
      message: `${event.title}\n${eventDate(event)} ${eventTime(event)}\n${event.location || ""}\n\n${event.description || ""}`
    });
  }

  return (
    <Screen>
      <TopBar title="Event" go={go} back="Events" />

      <ScrollView contentContainerStyle={s.scrollPad}>
        <Image source={{ uri: eventImage(event) }} style={s.detailImage} />

        <Text style={[s.detailTitle, { color: C.white }]}>{event.title}</Text>

        <View style={s.plainCard}>
          <View style={s.rowTight}>
            <Ionicons name="calendar-outline" size={18} color={C.gold} />
            <Text style={[s.rowTitle, { color: C.white }]}>{eventDate(event)}</Text>
          </View>

          <View style={[s.rowTight, { marginTop: 10 }]}>
            <Ionicons name="time-outline" size={18} color={C.gold} />
            <Text style={[s.mutedText, { color: C.muted }]}>{eventTime(event)}</Text>
          </View>

          <View style={[s.rowTight, { marginTop: 10 }]}>
            <Ionicons name="location-outline" size={18} color={C.gold} />
            <Text style={[s.mutedText, { color: C.muted }]}>{event.location || "Location to be announced"}</Text>
          </View>
        </View>

        <Text style={[s.detailBody, { color: C.white }]}>
          {event.description || "No event description available."}
        </Text>

        <Pressable style={s.primaryBtn} onPress={shareEvent}>
          <Text style={s.primaryText}>Share Event</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
