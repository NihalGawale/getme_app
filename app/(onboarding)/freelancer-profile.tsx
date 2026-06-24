import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
  Image,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState, useEffect, useMemo } from "react";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import FeatherIcon from "../../components/ui/FeatherIcon";

type City = { id: string; name: string; state: string };
type Skill = { id: string; name: string; icon: string };

const DEFAULT_SKILLS = [
  {
    id: "",
    name: "Photography",
    icon: <FeatherIcon name="camera" size={22} color="#888" />,
  },
  {
    id: "",
    name: "Videography",
    icon: <FeatherIcon name="video" size={22} color="#888" />,
  },
  {
    id: "",
    name: "Video Editing",
    icon: <FeatherIcon name="scissors" size={22} color="#888" />,
  },
  {
    id: "",
    name: "Graphic Design",
    icon: <FeatherIcon name="pen-tool" size={22} color="#888" />,
  },
  {
    id: "",
    name: "Drone Operation",
    icon: <FeatherIcon name="navigation" size={22} color="#888" />,
  },
  {
    id: "",
    name: "Voice Over",
    icon: <FeatherIcon name="mic" size={22} color="#888" />,
  },
  {
    id: "",
    name: "DJ / Music",
    icon: <FeatherIcon name="music" size={22} color="#888" />,
  },
  {
    id: "",
    name: "Copywriting",
    icon: <FeatherIcon name="edit-3" size={22} color="#888" />,
  },
  {
    id: "",
    name: "Motion Graphics",
    icon: <FeatherIcon name="activity" size={22} color="#888" />,
  },
  {
    id: "",
    name: "Social Media",
    icon: <FeatherIcon name="smartphone" size={22} color="#888" />,
  },
];

export default function FreelancerProfileScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [customSkill, setCustomSkill] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  console.log(customSkill, "custom skill ------------");

  // Data state
  const [cities, setCities] = useState<City[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [showCityModal, setShowCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [showCustomSkill, setShowCustomSkill] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    fetchCitiesAndSkills();
  }, []);

  const fetchCitiesAndSkills = async () => {
    const [{ data: citiesData }, { data: skillsData }] = await Promise.all([
      supabase
        .from("cities")
        .select("id, name, state")
        .eq("is_active", true)
        .order("name"),
      supabase.from("skills").select("id, name, icon").eq("is_active", true),
    ]);
    if (citiesData) setCities(citiesData);
    if (skillsData) setSkills(skillsData);
  };

  const filteredCities = useMemo(() => {
    const query = citySearch.trim().toLowerCase();
    if (!query) return cities;
    return cities.filter((city) => city.name.toLowerCase().startsWith(query));
  }, [cities, citySearch]);

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId)
        ? prev.filter((s) => s !== skillId)
        : [...prev, skillId],
    );
  };

const addCustomSkill = async () => {
  if (!customSkill.trim()) return;
  const { data, error } = await supabase
    .from("skills")
    .insert({ name: customSkill.trim(), icon: "⭐", is_active: true })
    .select()
    .single();

  console.log('Insert skill data:', data);
  console.log('Insert skill error:', error?.message);
  console.log('Insert skill error details:', JSON.stringify(error));

  if (data) {
    setSkills((prev) => [...prev, data]);
    setSelectedSkills((prev) => [...prev, data.id]);
    setCustomSkill("");
    setShowCustomSkill(false);
  } else {
    console.log('No data returned, skill not added');
  }
};
  const pickProfilePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setProfilePhoto(result.assets[0].uri);
    }
  };

  const uploadPhotoToCloudinary = async (
    uri: string,
  ): Promise<string | null> => {
    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append("file", {
        uri,
        type: "image/jpeg",
        name: "profile.jpg",
      } as any);
      formData.append("upload_preset", "getme_profiles");
      formData.append(
        "cloud_name",
        process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!,
      );

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData },
      );
      const data = await response.json();
      setUploadingPhoto(false);
      return data.secure_url ?? null;
    } catch (e) {
      setUploadingPhoto(false);
      return null;
    }
  };

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    selectedCity !== null &&
    selectedSkills.length > 0 &&
    bio.trim().length >= 30;

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;
    setLoading(true);

    try {
      let avatarUrl: string | null = null;
      if (profilePhoto) {
        avatarUrl = await uploadPhotoToCloudinary(profilePhoto);
      }

      const { error: userError } = await supabase
        .from("users")
        .update({
          name: `${firstName.trim()} ${lastName.trim()}`,
          avatar_url: avatarUrl,
          city_id: selectedCity!.id,
        })
        .eq("id", user.id);

      if (userError) throw userError;

      const { error: profileError } = await supabase
        .from("freelancer_profiles")
        .upsert(
          {
            user_id: user.id,
            bio: bio.trim(),
            skills: selectedSkills,
            is_published: true,
          },
          {
            onConflict: "user_id",
          },
        );

      if (profileError) throw profileError;

      await refreshProfile();
      router.replace("/(tabs)/");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        <Text style={s.title}>Let's build your profile</Text>
        <Text style={s.sub}>
          This is how clients will find and contact you.
        </Text>

        {/* Profile photo */}
        <Text style={s.label}>Profile photo</Text>
        <TouchableOpacity
          style={s.photoWrap}
          onPress={pickProfilePhoto}
          activeOpacity={0.8}
        >
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={s.photo} />
          ) : (
            <View style={s.photoPlaceholder}>
              <FeatherIcon
                name="camera"
                size={24}
                color={"#888"}
                style={s.photoIcon}
              />
              <Text style={s.photoText}>Add photo</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={s.optionalTag}>
          Optional - Profiles with a photo get noticed more
        </Text>

        {/* Name */}
        <Text style={s.label}>
          What should we call you? <Text style={s.required}>*</Text>
        </Text>
        <View style={s.nameRow}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="First name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Last name"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>
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
          <FeatherIcon
            name="chevron-down"
            size={18}
            color={"#888"}
            style={s.dropdownArrow}
          />
        </TouchableOpacity>

        {/* Skills */}
        <Text style={s.label}>
          What's your craft? <Text style={s.required}>*</Text>
        </Text>
        <Text style={s.labelSub}>Select all that apply</Text>
        <View style={s.skillGrid}>
          {skills.map((skill) => (
            <TouchableOpacity
              key={skill.id}
              style={[
                s.skillTile,
                selectedSkills.includes(skill.id) && s.skillTileSelected,
              ]}
              onPress={() => toggleSkill(skill.id)}
              activeOpacity={0.8}
            >
              <Text style={s.skillIcon}>{skill.icon}</Text>
              <Text
                style={[
                  s.skillLabel,
                  selectedSkills.includes(skill.id) && s.skillLabelSelected,
                ]}
              >
                {skill.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[s.skillTile, showCustomSkill && s.skillTileSelected]}
            onPress={() => setShowCustomSkill(!showCustomSkill)}
            activeOpacity={0.8}
          >
            <FeatherIcon
              name="plus"
              size={22}
              color="#888"
              style={s.skillIcon}
            />
            <Text style={s.skillLabel}>Add more</Text>
          </TouchableOpacity>
        </View>
        {showCustomSkill && (
          <View style={s.customSkillRow}>
            <View style={{ flex: 1 }}>
              <Input
                placeholder="e.g. Wedding DJ"
                value={customSkill}
                onChangeText={setCustomSkill}
                autoCapitalize="words"
              />
            </View>
            <Button label="Add" onPress={addCustomSkill} style={s.addBtn} />
          </View>
        )}

        {/* Bio */}
        <Text style={s.label}>
          Bio <Text style={s.required}>*</Text>
        </Text>
        <TextInput
          style={s.textArea}
          placeholder="Tell clients about your experience, style, and what you love doing..."
          placeholderTextColor={Colors.grey300}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          maxLength={300}
          textAlignVertical="top"
        />
        <Text
          style={[
            s.charCount,
            { color: bio.length < 30 ? Colors.danger : Colors.grey400 },
          ]}
        >
          {bio.length < 30
            ? `${30 - bio.length} more characters needed`
            : `${bio.length}/300`}
        </Text>

        {/* WhatsApp */}
        <Input
          label="WhatsApp number"
          prefix="+91"
          placeholder="98765 43210"
          keyboardType="phone-pad"
          value={whatsapp}
          onChangeText={setWhatsapp}
          maxLength={10}
          hint="Optional — clients will contact you directly on WhatsApp"
        />

        {/* Instagram */}
        <View style={s.fieldGap}>
          <Input
            label="Instagram handle"
            prefix="@"
            placeholder="yourhandle"
            autoCapitalize="none"
            autoCorrect={false}
            value={instagram}
            onChangeText={setInstagram}
            hint="Optional — clients can view your work on Instagram"
          />
        </View>

        {/* Submit */}
        <Button
          label="Create my profile"
          onPress={handleSubmit}
          loading={loading}
          disabled={!canSubmit}
          style={s.submitBtn}
        />

        <Text style={s.footerNote}>
          You can edit your profile anytime after setup.
        </Text>

        <View style={{ height: 40 }} />
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 56,
    paddingBottom: 100,
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
  labelSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    marginBottom: 10,
    marginTop: -4,
  },
  required: { color: Colors.danger },
  optionalTag: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey300,
    marginTop: Spacing.xs,
  },
  charCount: {
    fontSize: FontSize.xs,
    color: Colors.grey400,
    textAlign: "right",
    marginTop: Spacing.xs,
  },

  // Photo
  photoWrap: { alignSelf: "center", marginBottom: Spacing.xs },
  photo: { width: 88, height: 88, borderRadius: 44 },
  photoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.grey100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  photoIcon: { fontSize: 24 },
  photoText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
  },

  // Name row
  nameRow: { flexDirection: "row", gap: 10 },

  // Text area
  textArea: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    minHeight: 100,
  },

  // City dropdown trigger
  dropdown: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
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
  dropdownArrow: { fontSize: FontSize.sm, color: Colors.grey500 },

  // Skills
  skillGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  skillTile: {
    width: "30%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: "center",
    gap: 6,
  },
  skillTileSelected: {
    borderWidth: 1.5,
    borderColor: Colors.black,
    backgroundColor: Colors.grey100,
  },
  skillIcon: { fontSize: 22 },
  skillLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.grey500,
    textAlign: "center",
  },
  skillLabelSelected: { color: Colors.black },
  customSkillRow: { flexDirection: "row", gap: Spacing.sm, marginTop: 10 },
  addBtn: { height: Layout.inputHeight, paddingHorizontal: Spacing.lg },

  // Field gap
  fieldGap: { marginTop: Spacing.lg },

  // Submit
  submitBtn: { marginTop: 28 },
  footerNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey300,
    textAlign: "center",
    marginTop: Spacing.md,
  },

  // City modal
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
