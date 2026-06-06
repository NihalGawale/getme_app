import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SplashScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      <View style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.offWhite} />

        {/* Center content */}
        <View style={s.center}>
          <View style={s.wordmarkRow}>
            <Text style={s.wordmarkBlack}>Get </Text>
            <Text style={s.wordmarkGreen}>Me</Text>
          </View>
          <View style={s.greenLine} />
        </View>

        {/* Bottom content */}
        <View style={s.bottom}>
          <Text style={s.tagline}>GetMe. Get Discovered.</Text>
          <Text style={s.subtitle}>HYPERLOCAL DISCOVERY PLATFORM</Text>
          <TouchableOpacity
            style={s.btn}
            onPress={() => router.push("/(auth)/role")}
            activeOpacity={0.85}
          >
            <Text style={s.btnText}>Enter Experience →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.signInRow}
            onPress={() => router.push("/(auth)/phone")}
            activeOpacity={0.7}
          >
            <Text style={s.signInText}>Already have an account? </Text>
            <Text style={s.signInLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.offWhite,
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Spacing.xxxl,
    justifyContent: "space-between",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
  },
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  wordmarkBlack: {
    fontFamily: FontFamily.displayBold,
    fontSize: 56,
    color: Colors.black,
    letterSpacing: -2,
  },
  wordmarkGreen: {
    fontFamily: FontFamily.displayBold,
    fontSize: 56,
    color: Colors.green,
    letterSpacing: -2,
  },
  greenLine: {
    width: 40,
    height: 2,
    backgroundColor: Colors.green,
    borderRadius: Radius.full,
  },
  bottom: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  tagline: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.black,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.green,
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  btn: {
    width: "100%",
    height: Layout.buttonHeight,
    backgroundColor: Colors.black,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  signInRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
  },
  signInText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
  },
  signInLink: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.green,
  },
});
