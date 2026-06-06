import React from "react";
import { ScrollView } from "react-native";

import { s } from "../styles/appStyles";

export function Horizontal({ children }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.horizontal}
    >
      {children}
    </ScrollView>
  );
}
