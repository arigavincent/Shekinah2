import React from "react";
import { Pressable, Text, View } from "react-native";

import { s } from "../styles/appStyles";

export function Tabs({ tabs, active, setActive }) {
  return (
    <View style={s.tabs}>
      {tabs.map(tab => (
        <Pressable key={tab} style={s.tabBtn} onPress={() => setActive(tab)}>
          <Text style={[s.tabText, active === tab && s.tabActiveText]}>
            {tab}
          </Text>

          {active === tab ? <View style={s.tabUnderline} /> : null}
        </Pressable>
      ))}
    </View>
  );
}
