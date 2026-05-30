import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { Icons } from "../../constants/Icons";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

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
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        <Text style={s.title}>Almost there</Text>
        <Text style={s.sub}>
          Tell us your name so freelancers know who they're talking to.
        </Text>

        <Text style={s.label}>
          Full name <Text style={s.required}>*</Text>
        </Text>
        <View style={s.nameRow}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="First name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Last name"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
        </View>

        <Input
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          hint="Optional"
        />

        <View style={s.note}>
          <Text style={s.noteIcon}>{Icons.messages}</Text>
          <Text style={s.noteText}>
            Your name is shown to freelancers when you message them.
          </Text>
        </View>

        <Button
          label="Continue"
          onPress={handleSubmit}
          loading={loading}
          disabled={!canSubmit}
          style={s.submitBtn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: Layout.screenPadding, paddingTop: 60, paddingBottom: 40 },
  title: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xxl,
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
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.md,
    color: Colors.black,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
  },
  required: { color: Colors.danger },
  nameRow: { flexDirection: "row", gap: 10 },
  note: {
    flexDirection: "row",
    gap: Spacing.sm,
    backgroundColor: Colors.grey100,
    borderRadius: 10,
    padding: Spacing.md,
    alignItems: "flex-start",
    marginTop: Spacing.xl,
  },
  noteIcon: { fontSize: FontSize.md },
  noteText: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.grey500,
    flex: 1,
    lineHeight: 18,
  },
  submitBtn: { marginTop: 28 },
});
