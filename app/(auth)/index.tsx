import { View, Text, StyleSheet, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";
import Button from "../../components/ui/Button";

export default function SplashScreen() {
  const router = useRouter();
  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <View style={s.top}>
        <View style={s.icon}>
          <Text style={s.iconText}>gm</Text>
        </View>
        <View style={s.wordmarkRow}>
          <Text style={s.wordBlack}>Get</Text>
          <Text style={s.wordGreen}>Me</Text>
        </View>
        <Text style={s.tagline}>
          Find skilled people in your city.{"\n"}Instantly.
        </Text>
        <View style={s.props}>
          {[
            "Videographers, photographers, editors & more",
            "City-first. Real people. Real work.",
            "Free forever. Built on trust.",
          ].map((t, i) => (
            <View key={i} style={s.propRow}>
              <View style={s.dot} />
              <Text style={s.propText}>{t}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={s.bottom}>
        <Button
          label="Get started"
          onPress={() => router.push("/(auth)/role")}
        />
        <Button
          label="I already have an account"
          onPress={() => router.push("/(auth)/phone")}
          variant="secondary"
        />
        <Text style={s.terms}>
          By continuing you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  top: { alignItems: "center", gap: Spacing.xl },
  icon: {
    width: 64,
    height: 64,
    backgroundColor: Colors.black,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    color: Colors.white,
    letterSpacing: -0.5,
  },
  wordmarkRow: { flexDirection: "row" },
  wordBlack: {
    fontFamily: FontFamily.displayBold,
    fontSize: 42,
    color: Colors.black,
    letterSpacing: -1.5,
  },
  wordGreen: {
    fontFamily: FontFamily.displayBold,
    fontSize: 42,
    color: Colors.green,
    letterSpacing: -1.5,
  },
  tagline: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey500,
    textAlign: "center",
    lineHeight: 20,
  },
  props: { width: "100%", gap: Spacing.sm },
  propRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.grey100,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  dot: {
    width: Spacing.sm,
    height: Spacing.sm,
    borderRadius: Spacing.xs,
    backgroundColor: Colors.green,
  },
  propText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    flex: 1,
    lineHeight: 18,
  },
  bottom: { gap: Spacing.md },
  terms: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey300,
    textAlign: "center",
    lineHeight: 16,
  },
});
