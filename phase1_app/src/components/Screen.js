import React from "react";
import { KeyboardAvoidingView, Platform } from "react-native";

import { s } from "../styles/appStyles";

export function Screen({ children }) {
  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
