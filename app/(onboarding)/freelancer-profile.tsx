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
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

type City = { id: string; name: string };
type Skill = { id: string; name: string; icon: string };

const DEFAULT_SKILLS = [
  { id: "", name: "Photography", icon: "📷" },
  { id: "", name: "Videography", icon: "🎥" },
  { id: "", name: "Video Editing", icon: "✂️" },
  { id: "", name: "Graphic Design", icon: "🎨" },
  { id: "", name: "Drone Operation", icon: "🚁" },
  { id: "", name: "Voice Over", icon: "🎙️" },
  { id: "", name: "DJ / Music", icon: "🎵" },
  { id: "", name: "Copywriting", icon: "✍️" },
  { id: "", name: "Motion Graphics", icon: "✨" },
  { id: "", name: "Social Media", icon: "📱" },
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
      // Upload profile photo if selected
      let avatarUrl: string | null = null;
      if (profilePhoto) {
        avatarUrl = await uploadPhotoToCloudinary(profilePhoto);
      }

      // Update users table
      const { error: userError } = await supabase
        .from("users")
        .update({
          name: `${firstName.trim()} ${lastName.trim()}`,
          avatar_url: avatarUrl,
          city_id: selectedCity!.id,
        })
        .eq("id", user.id);

      if (userError) throw userError;

      // Create freelancer profile
      const { error: profileError } = await supabase
        .from("freelancer_profiles")
        .upsert(
          {
            user_id: user.id,
            bio: bio.trim(),
            skills: selectedSkills,
            whatsapp_number: whatsapp.trim() || null,
            instagram_handle: instagram.replace("@", "").trim() || null,
            is_published: true,
          },
          {
            onConflict: "user_id", // ← this is the fix
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
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        {/* Header */}
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
              <Text style={s.photoIcon}>📷</Text>
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
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="First name"
            placeholderTextColor="#D0D0D0"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Last name"
            placeholderTextColor="#D0D0D0"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />
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
                  <Text style={s.checkmark}>✓</Text>
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
          {/* Add custom skill */}
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
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="e.g. Wedding DJ"
              placeholderTextColor="#D0D0D0"
              value={customSkill}
              onChangeText={setCustomSkill}
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={s.addBtn}
              onPress={addCustomSkill}
              activeOpacity={0.85}
            >
              <Text style={s.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bio */}
        <Text style={s.label}>
          Bio <Text style={s.required}>*</Text>
        </Text>
        <TextInput
          style={s.textArea}
          placeholder="Tell clients about your experience, style, and what you love doing..."
          placeholderTextColor="#D0D0D0"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          maxLength={300}
          textAlignVertical="top"
        />
        <Text style={s.charCount}>{bio.length}/300</Text>

        {/* WhatsApp */}
        <Text style={s.label}>WhatsApp number</Text>
        <View style={s.inputRow}>
          <View style={s.prefix}>
            <Text style={s.prefixText}>+91</Text>
          </View>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="98765 43210"
            placeholderTextColor="#D0D0D0"
            keyboardType="phone-pad"
            value={whatsapp}
            onChangeText={setWhatsapp}
            maxLength={10}
          />
        </View>
        <Text style={s.optionalTag}>
          Optional — clients will contact you directly on WhatsApp
        </Text>

        {/* Instagram */}
        <Text style={s.label}>Instagram handle</Text>
        <View style={s.inputRow}>
          <View style={s.prefix}>
            <Text style={s.prefixText}>@</Text>
          </View>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="yourhandle"
            placeholderTextColor="#D0D0D0"
            autoCapitalize="none"
            autoCorrect={false}
            value={instagram}
            onChangeText={setInstagram}
          />
        </View>
        <Text style={s.optionalTag}>
          Optional — clients can view your work on Instagram
        </Text>

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
            <Text style={s.btnText}>Create my profile</Text>
          )}
        </TouchableOpacity>

        <Text style={s.footerNote}>
          You can edit your profile anytime after setup.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20 },
  title: { fontSize: 22, fontWeight: "500", color: "#111", marginBottom: 8 },
  sub: { fontSize: 13, color: "#6B6B68", marginBottom: 28, lineHeight: 20 },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#111",
    marginBottom: 8,
    marginTop: 20,
  },
  labelSub: { fontSize: 11, color: "#6B6B68", marginBottom: 10, marginTop: -4 },
  required: { color: "#E24B4A" },
  optionalTag: { fontSize: 11, color: "#D0D0D0", marginTop: 4 },
  charCount: {
    fontSize: 11,
    color: "#D0D0D0",
    textAlign: "right",
    marginTop: 4,
  },

  // Photo
  photoWrap: { alignSelf: "center", marginBottom: 4 },
  photo: { width: 88, height: 88, borderRadius: 44 },
  photoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#F4F4F4",
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  photoIcon: { fontSize: 24 },
  photoText: { fontSize: 11, color: "#6B6B68" },

  // Name row
  nameRow: { flexDirection: "row", gap: 10 },

  // Inputs
  input: {
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111",
    backgroundColor: "#fff",
  },
  inputRow: { flexDirection: "row", gap: 8 },
  prefix: {
    width: 48,
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  prefixText: { fontSize: 14, color: "#111", fontWeight: "500" },
  textArea: {
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111",
    minHeight: 100,
  },

  // Dropdown
  dropdown: {
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownSelected: { fontSize: 14, color: "#111" },
  dropdownPlaceholder: { fontSize: 14, color: "#D0D0D0" },
  dropdownArrow: { fontSize: 11, color: "#6B6B68" },
  dropdownList: {
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    marginTop: 4,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#F4F4F4",
  },
  dropdownItemSelected: { backgroundColor: "#F8F8F8" },
  dropdownItemText: { fontSize: 14, color: "#111" },
  dropdownItemTextSelected: { fontWeight: "500", color: "#111" },
  checkmark: { fontSize: 12, color: "#1D9E75", fontWeight: "500" },

  // Skills
  skillGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  skillTile: {
    width: "30%",
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  skillTileSelected: {
    borderWidth: 1.5,
    borderColor: "#111",
    backgroundColor: "#F8F8F8",
  },
  skillIcon: { fontSize: 22 },
  skillLabel: {
    fontSize: 10,
    color: "#6B6B68",
    textAlign: "center",
    fontWeight: "500",
  },
  skillLabelSelected: { color: "#111" },
  customSkillRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  addBtn: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addBtnText: { color: "#fff", fontSize: 14, fontWeight: "500" },

  // Button
  btnPrimary: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 14, fontWeight: "500", color: "#fff" },
  footerNote: {
    fontSize: 11,
    color: "#D0D0D0",
    textAlign: "center",
    marginTop: 12,
  },
});
