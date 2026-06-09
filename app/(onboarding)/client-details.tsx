import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";

type City = { id: string; name: string };

export default function ClientDetailsScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [showCitySheet, setShowCitySheet] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    const { data } = await supabase
      .from("cities")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    if (data) setCities(data);
  };

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    selectedCity !== null;

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;

    setLoading(true);

    const { error } = await supabase
      .from("users")
      .update({
        name: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim() || null,
        city_id: selectedCity!.id,
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        <Text style={s.title}>Almost there</Text>
        <Text style={s.sub}>
          Tell us a bit about yourself so freelancers know who they're talking
          to.
        </Text>

        {/* Full name */}
        <Text style={s.label}>
          Full name <Text style={s.required}>*</Text>
        </Text>
        <View style={s.nameRow}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="First name"
            placeholderTextColor={Colors.grey300}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Last name"
            placeholderTextColor={Colors.grey300}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* City */}
        <Text style={s.label}>
          City <Text style={s.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={s.dropdown}
          onPress={() => setShowCitySheet(true)}
          activeOpacity={0.8}
        >
          <Text
            style={selectedCity ? s.dropdownSelected : s.dropdownPlaceholder}
          >
            {selectedCity ? selectedCity.name : "Select your city"}
          </Text>
          <Text style={s.dropdownArrow}>▾</Text>
        </TouchableOpacity>

        {/* Email */}
        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          placeholder="you@example.com"
          placeholderTextColor={Colors.grey300}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={s.optional}>Optional</Text>

        {/* Note */}
        <View style={s.note}>
          <Text style={s.noteText}>
            💬 Your name is shown to freelancers when you message them.
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.btn, (!canSubmit || loading) && s.btnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={s.btnText}>Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* City bottom sheet */}
      <Modal
        visible={showCitySheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCitySheet(false)}
      >
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => setShowCitySheet(false)}
        />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Select your city</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {cities.map((city) => (
              <TouchableOpacity
                key={city.id}
                style={s.cityItem}
                onPress={() => {
                  setSelectedCity(city);
                  setShowCitySheet(false);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    s.cityName,
                    selectedCity?.id === city.id && s.cityNameSelected,
                  ]}
                >
                  {city.name}
                </Text>
                {selectedCity?.id === city.id && (
                  <Text style={s.cityCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 60,
    paddingBottom: 40,
  },
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
    marginBottom: Spacing.xxl,
    lineHeight: FontSize.md * 1.6,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.black,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  required: { color: Colors.danger },
  optional: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey300,
    marginTop: Spacing.xs,
  },
  nameRow: { flexDirection: "row", gap: Spacing.sm },
  input: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    fontFamily: FontFamily.regular,
    color: Colors.black,
    height: 48,
  },
  dropdown: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownSelected: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  dropdownPlaceholder: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.grey300,
  },
  dropdownArrow: {
    fontSize: FontSize.sm,
    color: Colors.grey500,
  },
  note: {
    backgroundColor: Colors.grey100,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.xl,
  },
  noteText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    lineHeight: FontSize.sm * 1.6,
  },
  btn: {
    backgroundColor: Colors.black,
    borderRadius: Radius.md,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xxl,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    maxHeight: "60%",
  },
  sheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: Colors.grey200,
    borderRadius: Radius.full,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  sheetTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.black,
    marginBottom: Spacing.md,
  },
  cityItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.grey100,
  },
  cityName: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  cityNameSelected: { fontWeight: "500" },
  cityCheck: {
    fontSize: FontSize.sm,
    color: Colors.green,
    fontWeight: "500",
  },
});
