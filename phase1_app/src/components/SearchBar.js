import React from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "./Icon";

import { C, makeThemedStyles } from "../constants/theme";

// Rounded search field (Phaneroo style): magnifier, input, clear button and
// an optional trailing action such as a sort/filter toggle.
export function SearchBar({ value, onChangeText, placeholder, trailingIcon, onTrailingPress, trailingLabel, trailingActive }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="search-outline" size={20} color={C.muted} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={8} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={C.faint} />
        </Pressable>
      ) : null}
      {trailingIcon ? (
        <Pressable
          onPress={onTrailingPress}
          hitSlop={8}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={trailingLabel}
        >
          <Ionicons name={trailingIcon} size={20} color={trailingActive ? C.accent : C.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = makeThemedStyles(C => ({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.lineStrong,
    borderRadius: 999,
    paddingLeft: 18,
    paddingRight: 8,
    height: 50
  },
  input: {
    flex: 1,
    color: C.white,
    fontSize: 15,
    fontFamily: C.fontBody,
    paddingVertical: 0
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" }
}));
