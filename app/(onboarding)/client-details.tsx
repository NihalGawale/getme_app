import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export default function ClientDetailsScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;

    setLoading(true);

    const { error } = await supabase
      .from("users")
      .update({
        name: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim() || null,
      })
      .eq("id", user.id);

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    await refreshProfile();
    router.replace("/(tabs)/");
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        {/* Header */}
        <Text style={s.title}>Almost there</Text>
        <Text style={s.sub}>
          Tell us your name so freelancers know who they're talking to.
        </Text>

        {/* First name + Last name */}
        <Text style={s.label}>
          Full name <Text style={s.required}>*</Text>
        </Text>
        <View style={s.nameRow}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="First name"
            placeholderTextColor="#D0D0D0"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Last name"
            placeholderTextColor="#D0D0D0"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* Email */}
        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          placeholder="you@example.com"
          placeholderTextColor="#D0D0D0"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={s.optionalTag}>Optional</Text>

        {/* Note */}
        <View style={s.note}>
          <Text style={s.noteIcon}>💬</Text>
          <Text style={s.noteText}>
            Your name is shown to freelancers when you message them.
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.btnPrimary, (!canSubmit || loading) && s.btnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnText}>Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "500", color: "#111", marginBottom: 8 },
  sub: { fontSize: 13, color: "#6B6B68", marginBottom: 28, lineHeight: 20 },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#111",
    marginBottom: 8,
    marginTop: 20,
  },
  required: { color: "#E24B4A" },
  optionalTag: { fontSize: 11, color: "#D0D0D0", marginTop: 4 },
  nameRow: { flexDirection: "row", gap: 10 },
  input: {
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: "#111",
    backgroundColor: "#fff",
  },
  note: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#F4F4F4",
    borderRadius: 10,
    padding: 12,
    alignItems: "flex-start",
    marginTop: 20,
  },
  noteIcon: { fontSize: 13 },
  noteText: { fontSize: 12, color: "#6B6B68", flex: 1, lineHeight: 18 },
  btnPrimary: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 14, fontWeight: "500", color: "#fff" },
});
