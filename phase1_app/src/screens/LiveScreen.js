import React from "react";
import {
  Image,
  ScrollView,
  Text,
  View
} from "react-native";

import { PHASE1_IMAGES } from "../content";
import { useContent } from "../providers/ContentProvider";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { EmptyState, VideoCard } from "../components/Cards";
import { SectionHeader } from "../components/SectionHeader";

export function LiveScreen({ go, openDrawer }) {
  const { data } = useContent();
  const live = data.live;
  return (
    <Screen>
      <TopBar title="Live Stream" go={go} onMenu={openDrawer} />
      <ScrollView contentContainerStyle={s.scrollPad}>
        {live.isLive ? (
          <>
            <View style={s.videoBox}>
              <Image source={{ uri: PHASE1_IMAGES.crowd }} style={s.videoImage} />
              <View style={s.videoOverlay}><Text style={s.liveNow}>LIVE NOW</Text></View>
            </View>
            <Text style={s.detailTitle}>{live.title}</Text>
            <Text style={s.goldSmall}>{live.viewers} watching</Text>
            <View style={s.reactionStrip}>
              {["Amen", "Glory", "Hallelujah", "Praying", "Blessed"].map(x => <Text key={x} style={s.reaction}>{x}</Text>)}
            </View>
          </>
        ) : (
          <EmptyState title="No live service right now" text={`Next service: ${live.nextService}`} />
        )}
        <SectionHeader title="Past Services" />
        {data.sermons.filter(x => x.type === "video").map(item => <VideoCard key={item.id} item={item} onPress={() => {}} wide />)}
      </ScrollView>
    </Screen>
  );
}
