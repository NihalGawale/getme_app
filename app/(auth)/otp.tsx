import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";
import Button from "../../components/ui/Button";

export default function OTPScreen() {
  const router = useRouter();
  const { phone, role } = useLocalSearchParams<{
    phone: string;
    role: string;
  }>();
  const { refreshProfile } = useAuth();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<TextInput[]>([]);

  const handleChange = (val: string, idx: number) => {
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handleBack = (idx: number) => {
    if (!otp[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
      const newOtp = [...otp];
      newOtp[idx - 1] = "";
      setOtp(newOtp);
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < 6) return;

    setLoading(true);

    // Step 1 — verify OTP
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });

    if (error) {
      setLoading(false);
      Alert.alert("Invalid code", "Please check the code and try again.");
      return;
    }

    const userId = data.session?.user?.id;
    const userPhone = data.session?.user?.phone ?? null;
    const userEmail = data.session?.user?.email ?? null;

    console.log("OTP verified — userId:", userId, "role:", role);

    if (!userId) {
      setLoading(false);
      Alert.alert("Error", "Session error. Please try again.");
      return;
    }

    // Step 2 — check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, role, name")
      .eq("id", userId)
      .single();

    if (existingUser) {
      console.log(
        "Existing user, role:",
        existingUser.role,
        "name:",
        existingUser.name,
      );
      await refreshProfile();
      setLoading(false);

      // Freelancer with no profile — go to profile setup
      if (existingUser.role === "freelancer") {
        const { data: fp } = await supabase
          .from("freelancer_profiles")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (!fp) {
          router.replace("/(onboarding)/freelancer-profile");
          return;
        }
      }

      // Client with no name — go to details
      if (existingUser.role === "client" && !existingUser.name) {
        router.replace("/(onboarding)/client-details");
        return;
      }

      // Everything complete
      router.replace("/(tabs)/");
      return;
    }

    // Step 3 — new user — save with role
    const { error: upsertError } = await supabase.from("users").upsert({
      id: userId,
      phone: userPhone,
      email: userEmail || null,
      role: role || "client",
    });
    
    if (upsertError) {
      setLoading(false);
      Alert.alert("Error", upsertError.message);
      return;
    }

    await refreshProfile();
    setLoading(false);

    // Step 4 — route based on role
    if (role === "freelancer") {
      router.replace("/(onboarding)/freelancer-profile");
    } else {
      router.replace("/(onboarding)/client-details");
    }
  };

  const filled = otp.join("").length === 6;

  return (
    <SafeAreaView style={s.safeArea} edges={["top", "bottom"]}>
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <View style={s.progress}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[s.bar, i < 3 && s.barActive]} />
        ))}
      </View>
      <Text style={s.title}>Enter the code</Text>
      <Text style={s.sub}>Sent to {phone}. Takes about 10 seconds.</Text>
      <View style={s.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={(el) => {
              if (el) inputs.current[i] = el;
            }}
            style={[s.otpBox, digit && s.otpFilled]}
            value={digit}
            onChangeText={(v) => handleChange(v.slice(-1), i)}
            onKeyPress={({ nativeEvent }) =>
              nativeEvent.key === "Backspace" && handleBack(i)
            }
            keyboardType="number-pad"
            maxLength={1}
          />
        ))}
      </View>
      <View style={s.resendRow}>
        <Text style={s.resendTimer}>Didn't receive it?</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.resendLink}>Change number</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1 }} />
      <Button
        label="Verify"
        onPress={handleVerify}
        loading={loading}
        disabled={!filled}
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
    marginBottom: 28,
    lineHeight: 20,
  },
  otpRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  otpBox: {
    flex: 1,
    height: 56,
    borderWidth: 0.5,
    borderColor: Colors.grey200,
    borderRadius: Radius.md,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xl,
    color: Colors.black,
    textAlign: "center",
  },
  otpFilled: { borderColor: Colors.black, backgroundColor: Colors.grey100 },
  resendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resendTimer: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.grey300,
  },
  resendLink: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.black,
  },
});
