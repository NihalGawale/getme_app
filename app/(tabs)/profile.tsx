import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  SafeAreaView,
} from "react-native";
import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize, TextStyles } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";
import { Icons } from "../../constants/Icons";
import Avatar from "../../components/ui/Avatar";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Divider from "../../components/ui/Divider";
import EmptyState from "../../components/ui/EmptyState";
import LoadingScreen from "../../components/ui/LoadingScreen";

type City = { id: string; name: string };
type Skill = { id: string; name: string; icon: string };

const GRID_SIZE = (Layout.screenWidth - Layout.screenPadding * 2) / 3;

// ─── Cloudinary upload ────────────────────────────────────────────────────────

async function uploadToCloudinary(uri: string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append("file", { uri, type: "image/jpeg", name: "upload.jpg" } as any);
    formData.append("upload_preset", "getme_profiles");
    formData.append("cloud_name", process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!);
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData },
    );
    const data = await response.json();
    return data.secure_url ?? null;
  } catch (e) {
    console.log("Cloudinary upload error:", e);
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, profile, refreshProfile, signOut } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);

  // Profile data
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [cityId, setCityId] = useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([]);

  // Original values for cancel
  const [originalData, setOriginalData] = useState<any>(null);

  // Lookup data
  const [cities, setCities] = useState<City[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showCitySheet, setShowCitySheet] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      if (user?.id) fetchProfileData();
    }, [user?.id]),
  );

  const fetchProfileData = async () => {
    if (!user?.id) return;
    setLoading(true);

    const [
      { data: userData },
      { data: fpData },
      { data: citiesData },
      { data: skillsData },
    ] = await Promise.all([
      supabase.from("users").select("name, avatar_url, city_id").eq("id", user.id).single(),
      supabase.from("freelancer_profiles").select("bio, skills, portfolio_urls").eq("user_id", user.id).single(),
      supabase.from("cities").select("id, name").eq("is_active", true).order("name"),
      supabase.from("skills").select("id, name, icon").eq("is_active", true),
    ]);

    if (citiesData) setCities(citiesData);
    if (skillsData) setSkills(skillsData);

    const fullName = userData?.name ?? "";
    const parts = fullName.split(" ");
    const fn = parts[0] ?? "";
    const ln = parts.slice(1).join(" ");
    const av = userData?.avatar_url ?? null;
    const cid = userData?.city_id ?? null;
    const b = fpData?.bio ?? "";
    const sk = fpData?.skills ?? [];
    const pu = fpData?.portfolio_urls ?? [];

    setFirstName(fn);
    setLastName(ln);
    setAvatarUrl(av);
    setCityId(cid);
    setBio(b);
    setSelectedSkills(sk);
    setPortfolioUrls(pu);
    setOriginalData({ fn, ln, av, cid, b, sk, pu });

    setLoading(false);
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  const fullName = [firstName, lastName].filter(Boolean).join(" ") || profile?.name || "";
  const selectedCity = cities.find((c) => c.id === cityId) ?? null;
  const skillObjects = selectedSkills
    .map((id) => skills.find((s) => s.id === id))
    .filter(Boolean) as Skill[];

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleCancel = () => {
    if (!originalData) return;
    setFirstName(originalData.fn);
    setLastName(originalData.ln);
    setAvatarUrl(originalData.av);
    setCityId(originalData.cid);
    setBio(originalData.b);
    setSelectedSkills(originalData.sk);
    setPortfolioUrls(originalData.pu);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);

    const { error: userErr } = await supabase
      .from("users")
      .update({ name: fullName, avatar_url: avatarUrl, city_id: cityId })
      .eq("id", user.id);

    if (userErr) {
      setSaving(false);
      Alert.alert("Error", userErr.message);
      return;
    }

    const { error: fpErr } = await supabase
      .from("freelancer_profiles")
      .upsert(
        { user_id: user.id, bio, skills: selectedSkills, portfolio_urls: portfolioUrls },
        { onConflict: "user_id" },
      );

    if (fpErr) {
      setSaving(false);
      Alert.alert("Error", fpErr.message);
      return;
    }

    await refreshProfile();
    const newOriginal = { fn: firstName, ln: lastName, av: avatarUrl, cid: cityId, b: bio, sk: selectedSkills, pu: portfolioUrls };
    setOriginalData(newOriginal);
    setSaving(false);
    setIsEditing(false);
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setUploadingPhoto(true);
    const url = await uploadToCloudinary(uri);
    setUploadingPhoto(false);
    if (url) setAvatarUrl(url);
  };

  const handleAddPortfolioImage = async () => {
    if (portfolioUrls.length >= 9) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setUploadingPortfolio(true);
    const url = await uploadToCloudinary(uri);
    setUploadingPortfolio(false);
    if (url) setPortfolioUrls((prev) => [...prev, url]);
  };

  const handleRemovePortfolioImage = (index: number) => {
    setPortfolioUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleSkill = (id: string) => {
    setSelectedSkills((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  // ── Loading / client guard ────────────────────────────────────────────────

  if (loading) return <LoadingScreen />;

  if (profile?.role === "client") {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Profile</Text>
        </View>
        <Card style={s.infoCard}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Name</Text>
            <Text style={s.infoValue}>{profile.name ?? "—"}</Text>
          </View>
          <View style={[s.infoRow, s.infoRowLast]}>
            <Text style={s.infoLabel}>Phone</Text>
            <Text style={s.infoValue}>{user?.phone ?? "—"}</Text>
          </View>
        </Card>
        <TouchableOpacity style={s.signOutRow} onPress={signOut}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Freelancer view ───────────────────────────────────────────────────────

  const content = isEditing ? (
    // ── EDIT MODE ──────────────────────────────────────────────────────────
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={s.avatarSection}>
          <View>
            {uploadingPhoto ? (
              <View style={[s.avatarLoadingWrap, { width: Layout.avatarXl, height: Layout.avatarXl, borderRadius: Layout.avatarXl / 2 }]}>
                <ActivityIndicator color={Colors.grey500} />
              </View>
            ) : (
              <Avatar name={fullName || profile?.name} uri={avatarUrl} size="xl" />
            )}
          </View>
          <TouchableOpacity onPress={handlePickAvatar}>
            <Text style={s.changePhotoText}>Change photo</Text>
          </TouchableOpacity>
        </View>

        {/* Name */}
        <View style={s.nameRow}>
          <TextInput
            style={[s.textInput, { flex: 1 }]}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={Colors.grey300}
          />
          <TextInput
            style={[s.textInput, { flex: 1 }]}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={Colors.grey300}
          />
        </View>

        {/* City */}
        <Text style={[TextStyles.label, s.sectionLabel]}>City</Text>
        <TouchableOpacity
          style={s.citySelector}
          onPress={() => setShowCitySheet(true)}
          activeOpacity={0.8}
        >
          <Text style={selectedCity ? s.citySelectorText : s.citySelectorPlaceholder}>
            {selectedCity?.name ?? "Select city"}
          </Text>
          <Text style={s.chevron}>{Icons.chevronDown}</Text>
        </TouchableOpacity>

        {/* Skills */}
        <Text style={[TextStyles.label, s.sectionLabel]}>Skills</Text>
        <Text style={s.skillsSubtitle}>Select all that apply</Text>
        <View style={s.skillsGrid}>
          {skills.map((skill) => {
            const active = selectedSkills.includes(skill.id);
            return (
              <TouchableOpacity
                key={skill.id}
                style={[s.skillTile, active && s.skillTileActive]}
                onPress={() => toggleSkill(skill.id)}
                activeOpacity={0.8}
              >
                <Text style={s.skillTileIcon}>{skill.icon}</Text>
                <Text style={[s.skillTileName, active && s.skillTileNameActive]}>
                  {skill.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bio */}
        <Text style={[TextStyles.label, s.sectionLabel]}>Bio</Text>
        <View style={s.bioWrap}>
          <TextInput
            style={s.bioInput}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell clients about yourself..."
            placeholderTextColor={Colors.grey300}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />
          <Text style={s.bioCounter}>{bio.length}/300</Text>
        </View>

        {/* Portfolio */}
        <Text style={[TextStyles.label, s.sectionLabel]}>Portfolio</Text>
        <View style={s.portfolioGrid}>
          {portfolioUrls.map((url, i) => (
            <View key={i} style={s.portfolioCell}>
              <Image source={{ uri: url }} style={s.portfolioImage} />
              <TouchableOpacity
                style={s.removeBtn}
                onPress={() => handleRemovePortfolioImage(i)}
              >
                <Text style={s.removeBtnText}>{Icons.close}</Text>
              </TouchableOpacity>
            </View>
          ))}
          {portfolioUrls.length < 9 && (
            <TouchableOpacity
              style={s.addCell}
              onPress={handleAddPortfolioImage}
              activeOpacity={0.7}
              disabled={uploadingPortfolio}
            >
              {uploadingPortfolio ? (
                <ActivityIndicator color={Colors.grey400} />
              ) : (
                <Text style={s.addCellIcon}>{Icons.plus}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: Spacing.huge }} />
      </ScrollView>
    </KeyboardAvoidingView>
  ) : (
    // ── VIEW MODE ──────────────────────────────────────────────────────────
    <ScrollView
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile top */}
      <View style={s.profileTop}>
        <Avatar name={fullName || profile?.name} uri={avatarUrl} size="xl" />
        <Text style={s.profileName}>{fullName || profile?.name}</Text>
        {selectedCity && (
          <Text style={s.profileCity}>{selectedCity.name}</Text>
        )}
      </View>

      <Divider />

      {/* About */}
      <View style={s.section}>
        <Text style={[TextStyles.label, s.sectionLabel]}>About</Text>
        {bio ? (
          <Text style={s.bioText}>{bio}</Text>
        ) : (
          <Text style={s.emptyFieldText}>Add a bio to tell clients about yourself</Text>
        )}
      </View>

      {/* Skills */}
      <View style={s.section}>
        <Text style={[TextStyles.label, s.sectionLabel]}>Skills</Text>
        {skillObjects.length > 0 ? (
          <View style={s.skillPills}>
            {skillObjects.map((skill) => (
              <View key={skill.id} style={s.skillPill}>
                <Text style={s.skillPillText}>{skill.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.emptyFieldText}>Add your skills</Text>
        )}
      </View>

      <Divider />

      {/* Portfolio */}
      <View style={s.section}>
        <Text style={[TextStyles.label, s.sectionLabel]}>Portfolio</Text>
        {portfolioUrls.length > 0 ? (
          <View style={s.portfolioGrid}>
            {portfolioUrls.map((url, i) => (
              <View key={i} style={s.portfolioCell}>
                <Image source={{ uri: url }} style={s.portfolioImage} />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="🖼️"
            title="No portfolio yet"
            subtitle="Add photos to show clients your work"
          />
        )}
      </View>

      {/* Sign out */}
      <TouchableOpacity style={s.signOutRow} onPress={signOut}>
        <Text style={s.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <View style={{ height: Spacing.huge }} />
    </ScrollView>
  );

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        {isEditing ? (
          <>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={s.headerAction}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={Colors.green} size="small" />
              ) : (
                <Text style={[s.headerAction, { color: Colors.green }]}>Save</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.headerTitle}>Profile</Text>
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Text style={[s.headerAction, { color: Colors.green }]}>Edit</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {content}

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
          <Text style={s.sheetTitle}>Select city</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {cities.map((city) => (
              <TouchableOpacity
                key={city.id}
                style={s.cityItem}
                onPress={() => {
                  setCityId(city.id);
                  setShowCitySheet(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={[s.cityName, cityId === city.id && s.cityNameSelected]}>
                  {city.name}
                </Text>
                {cityId === city.id && (
                  <Text style={s.cityCheck}>{Icons.check}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.grey100,
  },
  headerTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xl,
    color: Colors.black,
  },
  headerAction: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.black,
  },

  // Scroll
  scrollContent: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing.xl },

  // View mode — profile top
  profileTop: {
    alignItems: "center",
    paddingBottom: Spacing.xl,
    gap: Spacing.xs,
  },
  profileName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xxl,
    color: Colors.black,
    marginTop: Spacing.md,
  },
  profileCity: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey500,
    marginTop: Spacing.xs,
  },

  // Sections
  section: { paddingTop: Spacing.xl, paddingBottom: Spacing.xs },
  sectionLabel: { marginBottom: Spacing.md },
  bioText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    lineHeight: 22,
  },
  emptyFieldText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.grey300,
    fontStyle: "italic",
  },

  // Skill pills (view mode)
  skillPills: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  skillPill: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  skillPillText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.black,
  },

  // Portfolio grid (shared)
  portfolioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    marginLeft: -Layout.screenPadding,
    width: Layout.screenWidth,
  },
  portfolioCell: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    overflow: "hidden",
  },
  portfolioImage: {
    width: "100%",
    height: "100%",
  },

  // Edit mode — avatar section
  avatarSection: {
    alignItems: "center",
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  avatarLoadingWrap: {
    backgroundColor: Colors.grey100,
    alignItems: "center",
    justifyContent: "center",
  },
  changePhotoText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.green,
  },

  // Edit mode — name row
  nameRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  textInput: {
    height: Layout.inputHeight,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    backgroundColor: Colors.white,
  },

  // Edit mode — city
  citySelector: {
    height: Layout.inputHeight,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xl,
  },
  citySelectorText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  citySelectorPlaceholder: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.grey300,
  },
  chevron: { fontSize: FontSize.base, color: Colors.grey500 },

  // Edit mode — skills grid
  skillsSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    marginBottom: Spacing.md,
    marginTop: -Spacing.xs,
  },
  skillsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  skillTile: {
    width: "31%",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    gap: Spacing.xs,
  },
  skillTileActive: {
    borderWidth: 1.5,
    borderColor: Colors.black,
    backgroundColor: Colors.grey100,
  },
  skillTileIcon: { fontSize: 22 },
  skillTileName: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    textAlign: "center",
  },
  skillTileNameActive: { color: Colors.black },

  // Edit mode — bio
  bioWrap: { marginBottom: Spacing.xl },
  bioInput: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    minHeight: 100,
    textAlignVertical: "top",
  },
  bioCounter: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey400,
    textAlign: "right",
    marginTop: Spacing.xs,
  },

  // Edit mode — portfolio remove/add
  removeBtn: {
    position: "absolute",
    top: Spacing.xs,
    right: Spacing.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { fontSize: 10, color: Colors.white },
  addCell: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    backgroundColor: Colors.grey100,
    borderWidth: 0.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  addCellIcon: { fontSize: 24, color: Colors.grey400 },

  // Client view — info card
  infoCard: {
    overflow: "hidden",
    padding: 0,
    marginHorizontal: Layout.screenPadding,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxxl,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.grey100,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey500,
  },
  infoValue: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.md,
    color: Colors.black,
  },

  // Sign out
  signOutRow: {
    paddingVertical: 16,
    alignItems: "center",
  },
  signOutText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.danger,
  },

  // City sheet
  overlay: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Spacing.xl,
    borderTopRightRadius: Spacing.xl,
    padding: Layout.screenPadding,
    maxHeight: "60%",
  },
  sheetHandle: {
    width: Spacing.xxxl,
    height: 3,
    backgroundColor: Colors.grey200,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.md,
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
  cityNameSelected: { fontFamily: FontFamily.medium },
  cityCheck: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.md,
    color: Colors.green,
  },
});
