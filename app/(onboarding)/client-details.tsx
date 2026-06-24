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
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useMemo } from "react";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";

type City = { id: string; name: string; state: string };

export default function ClientDetailsScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [showCityModal, setShowCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    const { data } = await supabase
      .from("cities")
      .select("id, name, state")
      .eq("is_active", true)
      .order("name");
    if (data) setCities(data);
  };

  const filteredCities = useMemo(() => {
    const query = citySearch.trim().toLowerCase();
    if (!query) return cities;
    return cities.filter((city) => city.name.toLowerCase().startsWith(query));
  }, [cities, citySearch]);

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
          What should we call you? <Text style={s.required}>*</Text>
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
          Where are you located? <Text style={s.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={s.dropdown}
          onPress={() => {
            setCitySearch("");
            setShowCityModal(true);
          }}
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
        {/* <View style={s.note}>
          <Text style={s.noteText}>
            💬 Your name is shown to freelancers when you message them.
          </Text>
        </View> */}

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

      {/* City modal */}
      <Modal
        visible={showCityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCityModal(false)}
      >
        <View style={s.cityModalContainer}>
          <View style={s.cityModalCard}>
            <View style={s.cityModalHeader}>
              <Text style={s.cityModalTitle}>Select city</Text>
              <TouchableOpacity
                onPress={() => setShowCityModal(false)}
                activeOpacity={0.7}
                style={s.cityModalClose}
              >
                <Feather name="x" size={20} color={Colors.black} />
              </TouchableOpacity>
            </View>

            <View style={s.citySearchWrap}>
              <Feather
                name="search"
                size={16}
                color={Colors.grey400}
                style={s.citySearchIcon}
              />
              <TextInput
                style={s.citySearchInput}
                placeholder="Search city..."
                placeholderTextColor={Colors.grey300}
                value={citySearch}
                onChangeText={setCitySearch}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
              />
              {citySearch.length > 0 && (
                <TouchableOpacity onPress={() => setCitySearch("")}>
                  <Feather name="x-circle" size={16} color={Colors.grey400} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredCities}
              extraData={citySearch}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={s.cityList}
              ListEmptyComponent={
                <View style={s.cityEmptyWrap}>
                  <Text style={s.cityEmptyText}>
                    No cities found for "{citySearch}"
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    s.cityItem,
                    selectedCity?.id === item.id && s.cityItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedCity(item);
                    setShowCityModal(false);
                    setCitySearch("");
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.cityItemLeft}>
                    <Text
                      style={[
                        s.cityItemName,
                        selectedCity?.id === item.id && s.cityItemNameSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text style={s.cityItemState}>{item.state}</Text>
                  </View>
                  {selectedCity?.id === item.id && (
                    <Feather name="check" size={16} color={Colors.green} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
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
  cityModalContainer: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  cityModalCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    width: "100%",
    maxHeight: "80%",
    overflow: "hidden",
  },
  cityModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  cityModalTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.lg,
    color: Colors.black,
  },
  cityModalClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  citySearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    margin: Spacing.lg,
    backgroundColor: Colors.grey100,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  citySearchIcon: { flexShrink: 0 },
  citySearchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    height: 44,
  },
  cityList: { maxHeight: 400 },
  cityItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.grey100,
  },
  cityItemSelected: { backgroundColor: Colors.greenLight },
  cityItemLeft: { gap: 2 },
  cityItemName: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  cityItemNameSelected: {
    fontFamily: FontFamily.medium,
    color: Colors.greenDark,
  },
  cityItemState: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey400,
  },
  cityEmptyWrap: { padding: Spacing.xxxl, alignItems: "center" },
  cityEmptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey400,
    textAlign: "center",
  },
});
