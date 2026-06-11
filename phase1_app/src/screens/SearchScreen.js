import React, { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";

import { PHASE1_IMAGES } from "../content";
import { C } from "../constants/theme";
import { useContent } from "../providers/ContentProvider";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/Cards";

export function SearchScreen({ go, openSermon, appLanguage = "en" }) {
  const { data } = useContent();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const match = text => text.toLowerCase().includes(q);
    return [
      { title: "Sermons", items: data.sermons.filter(x => match(x.title) || match(x.speaker) || match(x.category)), type: "sermon" },
      { title: "Devotions", items: data.devotions.filter(x => match(x.title) || match(x.excerpt) || match(x.body)), type: "devotion" },
      { title: "Bible Verses", items: match(data.scripture.verse) || match(data.scripture.reference) ? [data.scripture] : [], type: "scripture" },
      { title: "Events", items: data.events.filter(x => match(x.title) || match(x.location)), type: "event" }
    ].filter(group => group.items.length);
  }, [query, data]);

  return (
    <Screen>
      <TopBar title="Global Search" go={go} back="Home" appLanguage={appLanguage} />
      <View style={s.pad}>
        <TextInput style={s.searchInput} placeholder="Search sermons, devotions, verses, events" placeholderTextColor={C.faint} value={query} onChangeText={setQuery} />
      </View>
      <ScrollView contentContainerStyle={s.scrollPad}>
        {query && groups.length === 0 ? <EmptyState title="No Results" text="Try another keyword." /> : null}
        {groups.map(group => (
          <View key={group.title}>
            <SectionHeader title={group.title} />
            {group.items.map((item, index) => (
              <Pressable
                key={item.id || group.title}
                style={s.listRow}
                onPress={() => {
                  if (group.type === "sermon") openSermon(item);
                  if (group.type === "devotion") go("DevotionDetail", item);
                  if (group.type === "event") go("EventDetail", item);
                }}
              >
                <Image source={{ uri: item.thumbnail || item.image || PHASE1_IMAGES.devotion }} style={s.rowImage} />
                <View style={s.rowBody}>
                  <Text style={s.rowTitle}>{item.title || item.reference}</Text>
                  <Text style={s.mutedText}>{group.title}{index === 0 && group.type === "scripture" ? ` - ${item.reference}` : ""}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
