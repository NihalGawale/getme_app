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
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

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
      email: userEmail || null, // ← convert empty string to null
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
      // Always send new clients to details screen
      // index.tsx will handle existing clients with names
      router.replace("/(onboarding)/client-details");
    }
  };

  const filled = otp.join("").length === 6;

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
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
      <TouchableOpacity
        style={[s.btnPrimary, (!filled || loading) && s.btnDisabled]}
        onPress={handleVerify}
        activeOpacity={0.85}
        disabled={!filled || loading}
      >
        <Text style={s.btnText}>{loading ? "Verifying..." : "Verify"}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  progress: { flexDirection: "row", gap: 4, marginBottom: 28 },
  bar: { flex: 1, height: 3, borderRadius: 99, backgroundColor: "#E8E8E8" },
  barActive: { backgroundColor: "#111" },
  title: { fontSize: 20, fontWeight: "500", color: "#111", marginBottom: 8 },
  sub: { fontSize: 13, color: "#6B6B68", marginBottom: 28, lineHeight: 20 },
  otpRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  otpBox: {
    flex: 1,
    height: 56,
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    fontSize: 20,
    fontWeight: "500",
    color: "#111",
    textAlign: "center",
  },
  otpFilled: { borderColor: "#111", backgroundColor: "#F8F8F8" },
  resendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resendTimer: { fontSize: 12, color: "#D0D0D0" },
  resendLink: { fontSize: 12, color: "#111", fontWeight: "500" },
  btnPrimary: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 14, fontWeight: "500", color: "#fff" },
});
