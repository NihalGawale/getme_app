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
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { Icons } from "../../constants/Icons";

type City = { id: string; name: string };
type Skill = { id: string; name: string; icon: string };

const DEFAULT_SKILLS = [
  { id: "", name: "Photography", icon: Icons.photography },
  { id: "", name: "Videography", icon: Icons.videography },
  { id: "", name: "Video Editing", icon: Icons.videoEditing },
  { id: "", name: "Graphic Design", icon: Icons.design },
  { id: "", name: "Drone Operation", icon: Icons.drone },
  { id: "", name: "Voice Over", icon: Icons.voiceOver },
  { id: "", name: "DJ / Music", icon: Icons.music },
  { id: "", name: "Copywriting", icon: Icons.copywriting },
  { id: "", name: "Motion Graphics", icon: Icons.motionGraphics },
  { id: "", name: "Social Media", icon: Icons.socialMedia },
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

  // Data state
  const [cities, setCities] = useState<City[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
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
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
      supabase.from("skills").select("id, name, icon").eq("is_active", true),
    ]);
    if (citiesData) setCities(citiesData);
    if (skillsData) setSkills(skillsData);
  };

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

    if (data) {
      setSkills((prev) => [...prev, data]);
      setSelectedSkills((prev) => [...prev, data.id]);
      setCustomSkill("");
      setShowCustomSkill(false);
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
    bio.trim().length > 0;

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
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        <Text style={s.title}>Set up your profile</Text>
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
              <Text style={s.photoIcon}>{Icons.photography}</Text>
              <Text style={s.photoText}>Add photo</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={s.optionalTag}>Optional</Text>

        {/* Name */}
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
          City <Text style={s.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={s.dropdown}
          onPress={() => setShowCityDropdown(!showCityDropdown)}
          activeOpacity={0.8}
        >
          <Text
            style={selectedCity ? s.dropdownSelected : s.dropdownPlaceholder}
          >
            {selectedCity ? selectedCity.name : "Select your city"}
          </Text>
          <Text style={s.dropdownArrow}>{showCityDropdown ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {showCityDropdown && (
          <View style={s.dropdownList}>
            {cities.map((city) => (
              <TouchableOpacity
                key={city.id}
                style={[
                  s.dropdownItem,
                  selectedCity?.id === city.id && s.dropdownItemSelected,
                ]}
                onPress={() => {
                  setSelectedCity(city);
                  setShowCityDropdown(false);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    s.dropdownItemText,
                    selectedCity?.id === city.id && s.dropdownItemTextSelected,
                  ]}
                >
                  {city.name}
                </Text>
                {selectedCity?.id === city.id && (
                  <Text style={s.checkmark}>{Icons.check}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Skills */}
        <Text style={s.label}>
          Skills <Text style={s.required}>*</Text>
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
            <Text style={s.skillIcon}>➕</Text>
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
            <Button
              label="Add"
              onPress={addCustomSkill}
              style={s.addBtn}
            />
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
        <Text style={s.charCount}>{bio.length}/300</Text>

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
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: Layout.screenPadding, paddingTop: 56, paddingBottom: Spacing.xl },
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
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey300,
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
    borderWidth: 0.5,
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

  // Text area (multiline — can't use Input component)
  textArea: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    minHeight: 100,
  },

  // Dropdown
  dropdown: {
    borderWidth: 0.5,
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
  dropdownList: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
    overflow: "hidden",
    backgroundColor: Colors.white,
  },
  dropdownItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.grey100,
  },
  dropdownItemSelected: { backgroundColor: Colors.grey100 },
  dropdownItemText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  dropdownItemTextSelected: { fontFamily: FontFamily.medium, color: Colors.black },
  checkmark: {
    fontSize: 12,
    color: Colors.green,
    fontFamily: FontFamily.medium,
  },

  // Skills
  skillGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  skillTile: {
    width: "30%",
    borderWidth: 0.5,
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
});
