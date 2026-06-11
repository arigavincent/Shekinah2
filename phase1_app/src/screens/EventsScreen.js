import React, { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useContent } from "../providers/ContentProvider";
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

function eventMeta(event) {
  const date = event?.date || event?.eventDate || "";
  const time = event?.time || event?.eventTime || "";

  if (date && time) return `${date} · ${time}`;
  return date || time;
}

function matchesQuery(event, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return [
    event?.title,
    event?.location,
    event?.description,
    event?.date,
    event?.time
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function EventRow({ event, onPress }) {
  return (
    <Pressable style={s.listRow} onPress={onPress}>
      <Image source={{ uri: eventImage(event) }} style={s.rowImage} />

      <View style={s.rowBody}>
        <Text style={[s.rowTitle, { color: C.white }]}>{event.title}</Text>
        <Text style={[s.goldSmall, { color: C.gold }]}>{eventMeta(event)}</Text>
        <Text style={[s.mutedText, { color: C.muted }]} numberOfLines={2}>
          {event.location}
        </Text>
      </View>

      <View style={s.playDot}>
        <Ionicons name="calendar-outline" size={18} color={C.white} />
      </View>
    </Pressable>
  );
}

export function EventsScreen({ go, appLanguage = "en" }) {
  const [query, setQuery] = useState("");
  const { data, loading, reload } = useContent();

  const events = Array.isArray(data.events) ? data.events : [];

  const validEvents = useMemo(() => {
    return events.filter(event => event?.id && event?.title);
  }, [events]);

  const visible = validEvents.filter(event => matchesQuery(event, query));

  return (
    <Screen>
      <TopBar title="Events" go={go} back="Home" appLanguage={appLanguage} />

      <View style={s.pad}>
        <TextInput
          style={s.searchInput}
          placeholder="Search events"
          placeholderTextColor={C.faint}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <ScrollView
        contentContainerStyle={s.scrollPad}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={reload}
            tintColor={C.gold}
            colors={[C.gold]}
            progressBackgroundColor={C.surface2}
          />
        }
      >
        {visible.length === 0 ? (
          <EmptyState
            title="No Events"
            text="Upcoming church events will appear here."
          />
        ) : (
          visible.map(event => (
            <EventRow
              key={event.id}
              event={event}
              onPress={() => go("EventDetail", event)}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
