import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";

export default function SplashScreen() {
  const router = useRouter();
  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
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
        <TouchableOpacity
          style={s.btnPrimary}
          onPress={() => router.push("/(auth)/role")}
          activeOpacity={0.85}
        >
          <Text style={s.btnPrimaryText}>Get started</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.btnSecondary}
          onPress={() => router.push("/(auth)/phone")}
          activeOpacity={0.85}
        >
          <Text style={s.btnSecondaryText}>I already have an account</Text>
        </TouchableOpacity>
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
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  top: { alignItems: "center", gap: 20 },
  icon: {
    width: 64,
    height: 64,
    backgroundColor: "#111",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.5,
  },
  wordmarkRow: { flexDirection: "row" },
  wordBlack: {
    fontSize: 42,
    fontWeight: "700",
    color: "#111",
    letterSpacing: -1.5,
  },
  wordGreen: {
    fontSize: 42,
    fontWeight: "700",
    color: "#1D9E75",
    letterSpacing: -1.5,
  },
  tagline: {
    fontSize: 13,
    color: "#6B6B68",
    textAlign: "center",
    lineHeight: 20,
  },
  props: { width: "100%", gap: 8 },
  propRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F4F4F4",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1D9E75" },
  propText: { fontSize: 11, color: "#6B6B68", flex: 1, lineHeight: 18 },
  bottom: { gap: 12 },
  btnPrimary: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnPrimaryText: { fontSize: 14, fontWeight: "500", color: "#fff" },
  btnSecondary: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
  },
  btnSecondaryText: { fontSize: 14, fontWeight: "500", color: "#111" },
  terms: {
    fontSize: 10,
    color: "#D0D0D0",
    textAlign: "center",
    lineHeight: 16,
  },
});
