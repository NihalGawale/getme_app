import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import FeatherIcon from "../../components/ui/FeatherIcon";
import { Layout } from "../../constants/Layout";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

export default function PhoneScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (phone.length < 10) {
      Alert.alert(
        "Invalid number",
        "Please enter a valid 10-digit mobile number",
      );
      return;
    }

    setLoading(true);
    const formattedPhone = `+91${phone.replace(/\s/g, "")}`;

    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
    });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    router.push({
      pathname: "/(auth)/otp",
      params: { phone: formattedPhone, role: role ?? "" },
    });
  };

  return (
    <SafeAreaView style={s.safeArea} edges={["top", "bottom"]}>
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <View style={s.progress}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[s.bar, i < 2 && s.barActive]} />
        ))}
      </View>
      <Text style={s.title}>What's your number?</Text>
      <Text style={s.sub}>
        We'll send a one-time code to verify. No spam, ever.
      </Text>
      <View style={s.inputWrap}>
        <Input
          prefix="+91"
          placeholder="98765 43210"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          maxLength={10}
        />
      </View>
      <View style={s.note}>
        <FeatherIcon name="lock" size={18} color={Colors.grey500} style={s.noteIcon} />
        <Text style={s.noteText}>
          Your number is never shown on your public profile.
        </Text>
      </View>
      <View style={{ flex: 1 }} />
      <Button
        label="Send OTP"
        onPress={handleSendOTP}
        loading={loading}
        disabled={phone.length < 10}
      />
    </KeyboardAvoidingView>
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
  progress: { flexDirection: "row", gap: Spacing.xs, marginBottom: 28 },
  bar: { flex: 1, height: 3, borderRadius: Radius.full, backgroundColor: Colors.grey200 },
  barActive: { backgroundColor: Colors.black },
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
  inputWrap: { marginBottom: Spacing.md },
  note: {
    flexDirection: "row",
    gap: Spacing.sm,
    backgroundColor: Colors.grey100,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    alignItems: "flex-start",
  },
  noteIcon: { fontSize: FontSize.md },
  noteText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    flex: 1,
    lineHeight: 17,
  },
});
