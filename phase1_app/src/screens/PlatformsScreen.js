import React from "react";
import { Linking, RefreshControl, ScrollView, Text, View } from "react-native";

import { useContent } from "../providers/ContentProvider";
import { C } from "../constants/theme";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { Tabs } from "../components/Tabs";
import { ActionButton } from "../components/ActionButton";

export function PlatformsScreen({ go, tab, setTab }) {
  const { data, loading, reload } = useContent();
  const platforms = data.platforms;
  const items = Array.isArray(platforms[tab]) ? platforms[tab] : [];

  return (
    <Screen>
      <TopBar title="Our Platforms" go={go} back="Home" />
      <Tabs tabs={["Web", "TV", "Radio"]} active={tab} setActive={setTab} />

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
        {items.map(item => (
          <View key={item.id} style={s.plainCard}>
            <Text style={s.rowTitle}>{item.name}</Text>
            <Text style={s.mutedText}>{item.description}</Text>

            {item.link ? (
              <ActionButton
                icon="open-outline"
                label="Open Link"
                onPress={() => Linking.openURL(item.link)}
              />
            ) : null}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
