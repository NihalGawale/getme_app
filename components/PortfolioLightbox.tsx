import { Dimensions, Modal, ScrollView, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  clamp,
} from "react-native-reanimated";
import { Colors } from "../constants/Colors";
import { FontFamily, FontSize } from "../constants/Typography";
import { Spacing, Radius } from "../constants/Spacing";
import { Layout } from "../constants/Layout";
import FeatherIcon from "./ui/FeatherIcon";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

function LightboxImage({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, 1, 4);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
    });

  const composed = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture,
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={{
          width,
          height,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.Image
          source={{ uri }}
          style={[{ width, height }, animatedStyle]}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}

type Props = {
  visible: boolean;
  urls: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

// Full-screen portfolio image viewer: pinch-zoom (1x-4x), pan while zoomed,
// double-tap to 2x, horizontal swipe between images, image counter.
// Relies on the root layout's GestureHandlerRootView — no nested one needed.
export default function PortfolioLightbox({
  visible,
  urls,
  index,
  onIndexChange,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.lightboxContainer}>
        <View style={s.lightboxOverlay} />

        <View style={s.lightboxCounter}>
          <Text style={s.lightboxCounterText}>
            {index + 1} / {urls.length}
          </Text>
        </View>

        <TouchableOpacity
          style={s.lightboxClose}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <FeatherIcon name="x" size={24} color={Colors.white} />
        </TouchableOpacity>

        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          contentOffset={{ x: index * SCREEN_WIDTH, y: 0 }}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            onIndexChange(i);
          }}
          style={s.lightboxScroll}
        >
          {urls.map((url, i) => (
            <LightboxImage
              key={i}
              uri={url}
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT}
            />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  lightboxContainer: {
    flex: 1,
    backgroundColor: Colors.overlayDark,
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlayDark,
  },
  lightboxCounter: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  lightboxCounterText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.white,
    opacity: 0.8,
  },
  lightboxClose: {
    position: "absolute",
    top: Layout.headerHeight,
    right: Spacing.xl,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: Radius.full,
  },
  lightboxScroll: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
});
