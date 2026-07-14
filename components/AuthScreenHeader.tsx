import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../constants/Colors";
import { FontFamily, FontSize } from "../constants/Typography";
import { Spacing } from "../constants/Spacing";
import { Layout } from "../constants/Layout";
import StepIndicator from "./ui/StepIndicator";

type AuthScreenHeaderProps = {
  step: number;
  totalSteps?: number;
  title: string;
  subtitle: string;
  /** Wraps the content in a KeyboardAvoidingView (needed on screens with a text input). */
  keyboardAvoiding?: boolean;
  children?: React.ReactNode;
};

export default function AuthScreenHeader({
  step,
  totalSteps = 5,
  title,
  subtitle,
  keyboardAvoiding = false,
  children,
}: AuthScreenHeaderProps) {
  const Container = keyboardAvoiding ? KeyboardAvoidingView : View;
  const containerProps = keyboardAvoiding
    ? { behavior: Platform.OS === "ios" ? ("padding" as const) : ("height" as const) }
    : {};

  return (
    <SafeAreaView style={s.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <Container style={s.container} {...containerProps}>
        <View style={s.progressWrap}>
          <StepIndicator total={totalSteps} current={step} />
        </View>
        <Text style={s.title}>{title}</Text>
        <Text style={s.sub}>{subtitle}</Text>
        {children}
      </Container>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  container: {
    flex: 1,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 56,
    paddingBottom: 40,
  },
  progressWrap: { marginBottom: 28 },
  title: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xl,
    color: Colors.black,
    marginBottom: Spacing.sm,
  },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey500,
    marginBottom: Spacing.xxl,
    lineHeight: 20,
  },
});
