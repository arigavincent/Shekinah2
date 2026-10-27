import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue
} from "react-native-reanimated";

// Horizontal rail with a depth effect, modelled on Phaneroo's sermon rows
// and pushed further: the card at the front is full size and bright, cards
// further along the row sit back (smaller, dimmer, turned slightly away) and
// swing forward as they arrive. Runs on the UI thread via Reanimated.
//
// position 0 = the card aligned with the left gutter (front)
// position 1 = the next card, mostly visible
// position 2 = the card entering from the right edge
const INPUT = [-1, 0, 1, 2];

export function CarouselRail({ data, itemWidth, gap = 12, gutter = 16, renderItem, keyExtractor, depth = 1 }) {
  const scrollX = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const step = itemWidth + gap;

  const onScroll = useAnimatedScrollHandler(event => {
    scrollX.value = event.contentOffset.x;
  });

  return (
    <Animated.ScrollView
      horizontal
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={step}
      snapToAlignment="start"
      contentContainerStyle={{ paddingHorizontal: gutter, gap }}
      style={{ marginHorizontal: -gutter }}
    >
      {data.map((item, index) => (
        <RailCard
          key={keyExtractor ? keyExtractor(item, index) : index}
          index={index}
          step={step}
          width={itemWidth}
          scrollX={scrollX}
          depth={reduceMotion ? 0 : depth}
        >
          {renderItem({ item, index, scrollX, step })}
        </RailCard>
      ))}
    </Animated.ScrollView>
  );
}

function RailCard({ index, step, width, scrollX, depth, children }) {
  const animatedStyle = useAnimatedStyle(() => {
    const position = (index * step - scrollX.value) / step;
    if (depth === 0) return {};

    const scale = interpolate(position, INPUT, [0.9, 1, 0.94, 0.84], Extrapolation.CLAMP);
    const opacity = interpolate(position, INPUT, [0.35, 1, 0.82, 0.45], Extrapolation.CLAMP);
    const rotateY = interpolate(position, INPUT, [14, 0, -6, -22], Extrapolation.CLAMP) * depth;
    // Pull later cards slightly toward the front one so the row feels stacked.
    const translateX = interpolate(position, INPUT, [width * 0.06, 0, -width * 0.03, -width * 0.12], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ perspective: 900 }, { translateX }, { rotateY: `${rotateY}deg` }, { scale }]
    };
  });

  return <Animated.View style={[{ width }, styles.card, animatedStyle]}>{children}</Animated.View>;
}

// Use inside a rail card: shifts its child against the scroll for parallax.
export function useParallax(scrollX, index, step, distance = 18) {
  const reduceMotion = useReducedMotion();
  return useAnimatedStyle(() => {
    if (reduceMotion) return {};
    const position = (index * step - scrollX.value) / step;
    return {
      transform: [{ translateX: interpolate(position, [-1, 0, 2], [distance, 0, -distance * 2], Extrapolation.CLAMP) }, { scale: 1.12 }]
    };
  });
}

// Glow strength for the card at the front (1) fading to 0 for others.
export function useFrontness(scrollX, index, step) {
  return useAnimatedStyle(() => {
    const position = (index * step - scrollX.value) / step;
    return { opacity: interpolate(position, [-0.8, 0, 0.8], [0, 1, 0], Extrapolation.CLAMP) };
  });
}

const styles = StyleSheet.create({
  card: { backfaceVisibility: "hidden" }
});
