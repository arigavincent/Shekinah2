import React from "react";
import { Image, ScrollView, Text, View } from "react-native";

import { useContent } from "../providers/ContentProvider";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";

export function UpdatesScreen({ go }) {
  const { data } = useContent();
  const updates = data.updates;

  return (
    <Screen>
      <TopBar title="Updates" go={go} back="Home" />

      <ScrollView contentContainerStyle={s.scrollPad}>
        {updates.map(item => (
          <View key={item.id} style={s.listRow}>
            <Image source={{ uri: item.image }} style={s.rowImage} />

            <View style={s.rowBody}>
              <Text style={s.rowTitle}>{item.title}</Text>
              <Text style={s.mutedText}>{item.excerpt}</Text>
              <Text style={s.goldSmall}>{item.date}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
