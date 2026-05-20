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
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function PhoneScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: string }>();
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
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={s.progress}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[s.bar, i < 2 && s.barActive]} />
        ))}
      </View>
      <Text style={s.title}>What's your number?</Text>
      <Text style={s.sub}>
        We'll send a one-time code to verify. No spam, ever.
      </Text>
      <View style={s.inputRow}>
        <View style={s.prefix}>
          <Text style={s.prefixText}>+91</Text>
        </View>
        <TextInput
          style={s.input}
          placeholder="98765 43210"
          placeholderTextColor="#D0D0D0"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          maxLength={10}
        />
      </View>
      <View style={s.note}>
        <Text style={s.noteIcon}>🔒</Text>
        <Text style={s.noteText}>
          Your number is never shown on your public profile.
        </Text>
      </View>
      <View style={{ flex: 1 }} />
      <TouchableOpacity
        style={[s.btnPrimary, (phone.length < 10 || loading) && s.btnDisabled]}
        onPress={handleSendOTP}
        activeOpacity={0.85}
        disabled={phone.length < 10 || loading}
      >
        <Text style={s.btnText}>{loading ? "Sending..." : "Send OTP"}</Text>
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
  sub: { fontSize: 13, color: "#6B6B68", marginBottom: 24, lineHeight: 20 },
  inputRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  prefix: {
    width: 52,
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  prefixText: { fontSize: 14, color: "#111", fontWeight: "500" },
  input: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: "#111",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111",
  },
  note: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#F4F4F4",
    borderRadius: 8,
    padding: 12,
    alignItems: "flex-start",
  },
  noteIcon: { fontSize: 13 },
  noteText: { fontSize: 11, color: "#6B6B68", flex: 1, lineHeight: 17 },
  btnPrimary: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 14, fontWeight: "500", color: "#fff" },
});
