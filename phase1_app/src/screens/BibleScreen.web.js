import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { useTheme } from '../hooks/ThemeContext';

export default function BibleScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <ScreenWrapper>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Offline Bible</Text>
        <Text style={styles.title}>This feature is packaged for the mobile app.</Text>
        <Text style={styles.body}>
          The built-in Bible uses a bundled SQLite database for the Android and iOS app so it stays available offline on your phone.
        </Text>
      </View>
    </ScreenWrapper>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      padding: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      ...theme.shadows.md,
    },
    eyebrow: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: theme.spacing.sm,
    },
    title: {
      color: theme.colors.text,
      fontSize: 28,
      fontWeight: '800',
      lineHeight: 34,
      marginBottom: theme.spacing.sm,
    },
    body: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
  });
}
