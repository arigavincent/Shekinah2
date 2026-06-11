import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { C } from "../constants/theme";
import { s } from "../styles/appStyles";

export function VideoCard({ item, onPress, wide }) {
  return (
    <Pressable style={wide ? s.wideVideoCard : s.videoCard} onPress={onPress}>
      <Image source={{ uri: item.thumbnail }} style={s.videoThumb} />
      <Text style={s.cardTitle}>
        {item.live ? "LIVE  " : ""}
        {item.title}
      </Text>
    </Pressable>
  );
}

export function AudioCard({ item, onPress }) {
  return (
    <Pressable style={s.audioCard} onPress={onPress}>
      <Image source={{ uri: item.thumbnail }} style={s.audioThumb} />
      <Text style={s.smallTitle}>{item.title}</Text>
    </Pressable>
  );
}

export function ClipCard({ item, onPress, style }) {
  const image = item.image || item.thumbnail;

  return (
    <Pressable style={[s.clipCard, style]} onPress={onPress}>
      <Image source={{ uri: image }} style={s.clipImage} />
      <View style={s.clipOverlay}>
        {item.duration ? <Text style={s.goldSmall}>{item.duration}</Text> : null}
        <Text style={s.clipText}>{item.title}</Text>
      </View>
    </Pressable>
  );
}

export function EventMiniCard({ item, onPress }) {
  return (
    <Pressable style={s.eventMini} onPress={onPress}>
      <Image source={{ uri: item.image }} style={s.eventMiniImage} />
      <Text style={s.cardTitle}>{item.title}</Text>
      <Text style={s.mutedText}>
        {item.date} - {item.time}
      </Text>
    </Pressable>
  );
}

export function EventLargeCard({ event, onPress }) {
  return (
    <Pressable style={s.eventLarge} onPress={onPress}>
      <Image source={{ uri: event.image }} style={s.eventLargeImage} />
      <Text style={s.cardTitle}>{event.title}</Text>
      <Text style={s.goldSmall}>
        {event.date} - {event.time}
      </Text>
      <Text style={s.mutedText}>{event.location}</Text>
      <Text style={s.mutedText}>{event.description}</Text>
    </Pressable>
  );
}

export function CategoryCard({ cat }) {
  return (
    <View style={s.categoryCard}>
      <Image source={{ uri: cat.image }} style={s.categoryImage} />
      <Text style={s.cardTitle}>{cat.name}</Text>
      <Text style={s.mutedText}>{cat.count} sermons</Text>
    </View>
  );
}

export function DevotionRow({ item, onPress }) {
  return (
    <Pressable style={s.listRow} onPress={onPress}>
      <Image source={{ uri: item.image }} style={s.rowImage} />
      <View style={s.rowBody}>
        <Text style={s.rowTitle}>{item.title}</Text>
        <Text style={s.mutedText}>{item.excerpt}</Text>
        <Text style={s.goldSmall}>{item.date}</Text>
      </View>
    </Pressable>
  );
}

export function EmptyState({ title, text }) {
  return (
    <View style={s.empty}>
      <Ionicons name="heart-outline" size={34} color={C.gold} />
      <Text style={s.detailTitle}>{title}</Text>
      <Text style={s.mutedText}>{text}</Text>
    </View>
  );
}
