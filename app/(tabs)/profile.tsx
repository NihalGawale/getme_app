import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize, TextStyles } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";
import Avatar from "../../components/ui/Avatar";
import FeedbackButton from "../../components/ui/FeedbackButton";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Divider from "../../components/ui/Divider";
import EmptyState from "../../components/ui/EmptyState";
import LoadingScreen from "../../components/ui/LoadingScreen";
import SkillPills from "../../components/SkillPills";
import { VibeSummaryPills, ReviewVibePills } from "../../components/VibePills";
import PortfolioGrid from "../../components/PortfolioGrid";
import PortfolioLightbox from "../../components/PortfolioLightbox";
import { uploadToCloudinary } from "../../lib/cloudinary";
import { formatMemberSince } from "../../lib/format";
import type { City } from "../../types/city";
import type { Review } from "../../types/review";

type Skill = { id: string; name: string; icon: string };

type OriginalProfileData = {
  fn: string;
  ln: string;
  av: string | null;
  cid: string | null;
  b: string;
  sk: string[];
  pu?: string[];
};

const GRID_SIZE = Math.floor(
  (Dimensions.get("window").width - Spacing.lg * 2 - 4) / 3,
);

// ─── Shared edit-mode fields (used by both client and freelancer forms) ──────

function NameFields({
  firstName,
  lastName,
  onFirstNameChange,
  onLastNameChange,
}: {
  firstName: string;
  lastName: string;
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
}) {
  return (
    <View style={s.nameRow}>
      <TextInput
        style={[s.textInput, { flex: 1 }]}
        value={firstName}
        onChangeText={onFirstNameChange}
        placeholder="First name"
        placeholderTextColor={Colors.grey300}
      />
      <TextInput
        style={[s.textInput, { flex: 1 }]}
        value={lastName}
        onChangeText={onLastNameChange}
        placeholder="Last name"
        placeholderTextColor={Colors.grey300}
      />
    </View>
  );
}

function CityField({
  selectedCity,
  onPress,
}: {
  selectedCity: City | null;
  onPress: () => void;
}) {
  return (
    <>
      <Text style={[TextStyles.label, s.sectionLabel]}>City</Text>
      <TouchableOpacity
        style={s.citySelector}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text
          style={selectedCity ? s.citySelectorText : s.citySelectorPlaceholder}
        >
          {selectedCity?.name ?? "Select city"}
        </Text>
        <Feather name="chevron-down" size={14} color={Colors.grey500} />
      </TouchableOpacity>
    </>
  );
}

function SkillsEditGrid({
  skills,
  selected,
  onToggle,
}: {
  skills: Skill[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <View style={s.skillsGrid}>
      {skills.map((skill) => {
        const active = selected.includes(skill.id);
        return (
          <TouchableOpacity
            key={skill.id}
            style={[s.skillTile, active && s.skillTileActive]}
            onPress={() => onToggle(skill.id)}
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
  );
}

function SkillsViewSection({
  label,
  skillObjects,
  emptyText,
}: {
  label: string;
  skillObjects: Skill[];
  emptyText: string;
}) {
  return (
    <View style={s.section}>
      <Text style={[TextStyles.label, s.sectionLabel]}>{label}</Text>
      {skillObjects.length > 0 ? (
        <SkillPills skills={skillObjects.map((skill) => skill.name)} />
      ) : (
        <Text style={s.emptyFieldText}>{emptyText}</Text>
      )}
    </View>
  );
}

function BioViewSection({
  label,
  bio,
  emptyText,
}: {
  label: string;
  bio: string;
  emptyText: string;
}) {
  return (
    <View style={s.section}>
      <Text style={[TextStyles.label, s.sectionLabel]}>{label}</Text>
      {bio ? (
        <Text style={s.bioText}>{bio}</Text>
      ) : (
        <Text style={s.emptyFieldText}>{emptyText}</Text>
      )}
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  // Inside the component
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
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
  const [originalData, setOriginalData] = useState<OriginalProfileData | null>(
    null,
  );

  // Lookup data
  const [cities, setCities] = useState<City[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showCitySheet, setShowCitySheet] = useState(false);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);

  // Reviews
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [showMyReviewsSheet, setShowMyReviewsSheet] = useState(false);

  // Lightbox
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // ── Fetch ────────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      if (user?.id) fetchProfileData();
    }, [user?.id]),
  );

  useFocusEffect(
    useCallback(() => {
      if (user) fetchMyReviews();
    }, [user]),
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
      supabase
        .from("users")
        .select("name, avatar_url, city_id, bio, looking_for, created_at")
        .eq("id", user.id)
        .single(),
      supabase
        .from("freelancer_profiles")
        .select("bio, skills, portfolio_urls")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("cities")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
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

    setUserCreatedAt(userData?.created_at ?? null);

    if (profile?.role === "client") {
      const b = userData?.bio ?? "";
      const sk = (userData?.looking_for ?? []) as string[];
      setFirstName(fn);
      setLastName(ln);
      setAvatarUrl(av);
      setCityId(cid);
      setBio(b);
      setSelectedSkills(sk);
      setPhotoChanged(false);
      setOriginalData({ fn, ln, av, cid, b, sk });
    } else {
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
    }

    setLoading(false);
  };

  const fetchMyReviews = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("reviews")
      .select(
        `
        id,
        vibes,
        note,
        created_at,
        client_id,
        users!reviews_client_id_fkey (
          name,
          avatar_url,
          city_id,
          cities (
            name
          )
        )
      `,
      )
      .eq("freelancer_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setMyReviews(data as unknown as Review[]);
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  const fullName =
    [firstName, lastName].filter(Boolean).join(" ") || profile?.name || "";
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
    if (profile?.role !== "client") setPortfolioUrls(originalData.pu ?? []);
    setPhotoChanged(false);
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

    const { error: fpErr } = await supabase.from("freelancer_profiles").upsert(
      {
        user_id: user.id,
        bio,
        skills: selectedSkills,
        portfolio_urls: portfolioUrls,
      },
      { onConflict: "user_id" },
    );

    if (fpErr) {
      setSaving(false);
      Alert.alert("Error", fpErr.message);
      return;
    }

    await refreshProfile();
    const newOriginal = {
      fn: firstName,
      ln: lastName,
      av: avatarUrl,
      cid: cityId,
      b: bio,
      sk: selectedSkills,
      pu: portfolioUrls,
    };
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

  const handlePickAvatarClient = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    setAvatarUrl(result.assets[0].uri);
    setPhotoChanged(true);
  };

  const handleClientSave = async () => {
    if (!user?.id) return;
    setSaving(true);

    let finalAvatarUrl = avatarUrl;
    if (photoChanged && avatarUrl) {
      const uploaded = await uploadToCloudinary(avatarUrl);
      if (uploaded) finalAvatarUrl = uploaded;
    }

    const { error } = await supabase
      .from("users")
      .update({
        name: fullName,
        avatar_url: finalAvatarUrl,
        city_id: cityId,
        bio: bio.trim() || null,
        looking_for: selectedSkills,
      })
      .eq("id", user.id);

    if (error) {
      Alert.alert("Error", error.message);
      setSaving(false);
      return;
    }

    setAvatarUrl(finalAvatarUrl);
    setPhotoChanged(false);
    setOriginalData({
      fn: firstName,
      ln: lastName,
      av: finalAvatarUrl,
      cid: cityId,
      b: bio,
      sk: selectedSkills,
    });
    await refreshProfile();
    setSaving(false);
    setIsEditing(false);
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

  // Sign out handler
  const handleSignOut = async () => {
    setShowMenu(false);
    await signOut();
    router.replace("/(auth)/");
  };

  const getProfileCompletion = () => {
    const checks = [
      { label: "Profile photo", done: !!avatarUrl },
      { label: "Bio", done: bio.trim().length >= 30 },
      { label: "Skills", done: selectedSkills.length > 0 },
      { label: "Portfolio", done: portfolioUrls.length > 0 },
      { label: "City", done: !!cityId },
    ];
    const completed = checks.filter((c) => c.done).length;
    const percentage = Math.round((completed / checks.length) * 100);
    return { checks, completed, total: checks.length, percentage };
  };

  // ── Loading / client guard ────────────────────────────────────────────────

  if (loading) return <LoadingScreen />;

  // ── Derived: member since ────────────────────────────────────────────────
  const memberSince = formatMemberSince(userCreatedAt);

  // ── Client content ────────────────────────────────────────────────────────
  const clientContent = isEditing ? (
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
          <Avatar name={fullName || profile?.name} uri={avatarUrl} size="xl" />
          <TouchableOpacity
            onPress={handlePickAvatarClient}
            style={s.changePhotoBtn}
          >
            <Text style={s.changePhotoText}>Change photo</Text>
          </TouchableOpacity>
        </View>

        {/* Name */}
        <NameFields
          firstName={firstName}
          lastName={lastName}
          onFirstNameChange={setFirstName}
          onLastNameChange={setLastName}
        />

        {/* City */}
        <CityField
          selectedCity={selectedCity}
          onPress={() => setShowCitySheet(true)}
        />

        {/* Bio */}
        <Text style={[TextStyles.label, s.sectionLabel]}>ABOUT</Text>
        <View style={s.bioWrap}>
          <TextInput
            style={s.bioInput}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell freelancers what kind of work you usually need..."
            placeholderTextColor={Colors.grey300}
            multiline
            maxLength={200}
            textAlignVertical="top"
          />
          <Text style={s.bioCounter}>{bio.length}/200</Text>
        </View>

        {/* Looking for */}
        <Text style={[TextStyles.label, s.sectionLabel]}>
          WHAT DO YOU NEED?
        </Text>
        <Text style={s.skillsSubtitle}>
          Select skills you frequently look for
        </Text>
        <SkillsEditGrid
          skills={skills}
          selected={selectedSkills}
          onToggle={toggleSkill}
        />

        <View style={{ height: Spacing.huge }} />
      </ScrollView>
    </KeyboardAvoidingView>
  ) : (
    <ScrollView
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile top */}
      <View style={s.profileTop}>
        <Avatar name={fullName || profile?.name} uri={avatarUrl} size="xl" />
        <Text style={s.profileName}>{fullName || profile?.name}</Text>
        <Text style={s.profileCity}>
          {[
            selectedCity?.name,
            memberSince ? `Member since ${memberSince}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>

      <Divider />

      {/* About */}
      <BioViewSection
        label="ABOUT"
        bio={bio}
        emptyText="Add a bio to tell freelancers about yourself"
      />

      {/* Looking for */}
      <SkillsViewSection
        label="LOOKING FOR"
        skillObjects={skillObjects}
        emptyText="Add the skills you frequently need"
      />

      <View style={{ height: Spacing.huge }} />
    </ScrollView>
  );

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
              <View
                style={[
                  s.avatarLoadingWrap,
                  {
                    width: Layout.avatarXl,
                    height: Layout.avatarXl,
                    borderRadius: Layout.avatarXl / 2,
                  },
                ]}
              >
                <ActivityIndicator color={Colors.grey500} />
              </View>
            ) : (
              <Avatar
                name={fullName || profile?.name}
                uri={avatarUrl}
                size="xl"
              />
            )}
          </View>
          <TouchableOpacity onPress={handlePickAvatar} style={s.changePhotoBtn}>
            <Feather name="camera" size={16} color={Colors.green} />
            <Text style={s.changePhotoText}>Change photo</Text>
          </TouchableOpacity>
        </View>

        {/* Name */}
        <NameFields
          firstName={firstName}
          lastName={lastName}
          onFirstNameChange={setFirstName}
          onLastNameChange={setLastName}
        />

        {/* City */}
        <CityField
          selectedCity={selectedCity}
          onPress={() => setShowCitySheet(true)}
        />

        {/* Skills */}
        <Text style={[TextStyles.label, s.sectionLabel]}>Skills</Text>
        <Text style={s.skillsSubtitle}>Select all that apply</Text>
        <SkillsEditGrid
          skills={skills}
          selected={selectedSkills}
          onToggle={toggleSkill}
        />

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
        <PortfolioGrid
          urls={portfolioUrls}
          cellSize={GRID_SIZE}
          editable
          onRemove={handleRemovePortfolioImage}
          onAdd={handleAddPortfolioImage}
          maxCount={9}
          uploading={uploadingPortfolio}
        />

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
        {selectedCity && <Text style={s.profileCity}>{selectedCity.name}</Text>}
      </View>

      <Divider />

      {/* About */}
      <BioViewSection
        label="About"
        bio={bio}
        emptyText="Add a bio to tell clients about yourself"
      />

      {/* Skills */}
      <SkillsViewSection
        label="Skills"
        skillObjects={skillObjects}
        emptyText="Add your skills"
      />

      {/* Reviews section */}
      {myReviews.length > 0 ? (
        <View style={s.section}>
          <View style={s.reviewsHeaderRow}>
            <Text style={[TextStyles.label, s.sectionLabel]}>
              Reviews & Vibes
            </Text>
            <View style={s.reviewCountBadge}>
              <Text style={s.reviewCountText}>{myReviews.length}</Text>
            </View>
          </View>

          {/* Vibe summary */}
          <VibeSummaryPills reviews={myReviews} />

          <TouchableOpacity
            style={s.seeAllBtn}
            onPress={() => setShowMyReviewsSheet(true)}
            activeOpacity={0.85}
          >
            <Text style={s.seeAllBtnText}>
              See all reviews ({myReviews.length})
            </Text>
            <Feather name="chevron-right" size={16} color={Colors.black} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.section}>
          <Text style={[TextStyles.label, s.sectionLabel]}>Reviews</Text>
          <View style={s.noReviewsWrap}>
            <Text style={s.noReviewsText}>
              No reviews yet. Complete jobs to get reviews from clients.
            </Text>
          </View>
        </View>
      )}

      {(() => {
        const completion = getProfileCompletion();
        if (completion.percentage === 100) return null;
        return (
          <View style={s.completionWrap}>
            <View style={s.completionHeader}>
              <Text style={s.completionTitle}>
                Profile {completion.percentage}% complete
              </Text>
              <Text style={s.completionSub}>
                Complete your profile to get more clients
              </Text>
            </View>

            {/* Progress bar */}
            <View style={s.progressBar}>
              <View
                style={[
                  s.progressFill,
                  { width: `${completion.percentage}%` as const },
                ]}
              />
            </View>

            {/* Missing items */}
            <View style={s.completionItems}>
              {completion.checks
                .filter((c) => !c.done)
                .map((check, i) => (
                  <TouchableOpacity
                    key={i}
                    style={s.completionItem}
                    onPress={() => setIsEditing(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.completionItemIcon}>○</Text>
                    <Text style={s.completionItemText}>
                      Add {check.label.toLowerCase()}
                    </Text>
                    <Feather
                      name="chevron-right"
                      size={14}
                      color={Colors.grey400}
                    />
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        );
      })()}

      <Divider />

      {/* Portfolio */}
      <View style={s.section}>
        <Text style={[TextStyles.label, s.sectionLabel]}>Portfolio</Text>
        {portfolioUrls.length > 0 ? (
          <View style={s.portfolioViewWrap}>
            <PortfolioGrid
              urls={portfolioUrls}
              cellSize={GRID_SIZE}
              onPressImage={(i) => {
                setLightboxIndex(i);
                setLightboxVisible(true);
              }}
            />
          </View>
        ) : (
          <EmptyState
            icon="🖼️"
            title="No portfolio yet"
            subtitle="Add photos to show clients your work"
          />
        )}
      </View>

      <View style={{ height: Spacing.huge }} />
    </ScrollView>
  );

  return (
    <>
      <SafeAreaView
        style={[s.container, { position: "relative", zIndex: 100 }]}
        edges={["top"]}
      >
        {/* Header */}
        <View style={s.header}>
          {isEditing ? (
            <>
              <TouchableOpacity onPress={handleCancel}>
                <Text style={s.headerAction}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.headerTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={
                  profile?.role === "client" ? handleClientSave : handleSave
                }
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.green} size="small" />
                ) : (
                  <Text style={[s.headerAction, { color: Colors.green }]}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.headerTitle}>Profile</Text>
              <TouchableOpacity
                onPress={() => setShowMenu(!showMenu)}
                style={s.menuBtn}
                activeOpacity={0.7}
              >
                <Feather name="more-vertical" size={20} color={Colors.black} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Dropdown menu (top-right) */}
        {showMenu && (
          <>
            {/* Invisible overlay to close menu on outside tap */}
            <TouchableOpacity
              style={s.menuDismiss}
              activeOpacity={1}
              onPress={() => setShowMenu(false)}
            />

            {/* Dropdown menu */}
            <View style={s.dropdown}>
              <TouchableOpacity
                style={s.dropdownItem}
                onPress={() => {
                  setShowMenu(false);
                  setIsEditing(true);
                }}
                activeOpacity={0.7}
              >
                <Feather name="edit-2" size={16} color={Colors.black} />
                <Text style={s.dropdownText}>Edit profile</Text>
              </TouchableOpacity>

              <View style={s.dropdownDivider} />

              <TouchableOpacity
                style={s.dropdownItem}
                onPress={() => {
                  setShowMenu(false);
                  handleSignOut();
                }}
                activeOpacity={0.7}
              >
                <Feather name="log-out" size={16} color={Colors.danger} />
                <Text style={[s.dropdownText, { color: Colors.danger }]}>
                  Sign out
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {profile?.role === "client" ? clientContent : content}

        {/* City bottom sheet (inline, no Modal) */}
        {showCitySheet && (
          <>
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
                    <Text
                      style={[
                        s.cityName,
                        cityId === city.id && s.cityNameSelected,
                      ]}
                    >
                      {city.name}
                    </Text>
                    {cityId === city.id && (
                      <Feather name="check" size={14} color={Colors.green} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        )}
      </SafeAreaView>

      <Modal
        visible={showMyReviewsSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMyReviewsSheet(false)}
      >
        <View style={s.reviewSheetContainer}>
          <TouchableOpacity
            style={s.reviewSheetOverlay}
            activeOpacity={1}
            onPress={() => setShowMyReviewsSheet(false)}
          />
          <View style={s.reviewSheet}>
            <View style={s.reviewSheetHandle} />
            <View style={s.reviewSheetHeader}>
              <Text style={s.reviewSheetTitle}>Your reviews</Text>
              <TouchableOpacity
                onPress={() => setShowMyReviewsSheet(false)}
                activeOpacity={0.7}
              >
                <Feather name="x" size={20} color={Colors.black} />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.reviewSheetContent}
            >
              {myReviews.map((review, index) => (
                <View key={review.id}>
                  <View style={s.reviewItem}>
                    <View style={s.reviewClientRow}>
                      <Avatar
                        uri={review.users?.avatar_url}
                        name={review.users?.name}
                        size="sm"
                      />
                      <View style={s.reviewClientInfo}>
                        <Text style={s.reviewClientName}>
                          {review.users?.name ?? "Client"}
                        </Text>
                        <Text style={s.reviewClientMeta}>
                          {review.users?.cities?.name ?? ""}
                          {review.users?.cities?.name ? " · " : ""}
                          {new Date(review.created_at).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </Text>
                      </View>
                    </View>
                    <ReviewVibePills vibeIds={review.vibes} />
                    {review.note ? (
                      <Text style={s.reviewNoteText}>"{review.note}"</Text>
                    ) : null}
                  </View>
                  {index < myReviews.length - 1 && (
                    <View style={s.reviewDivider} />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <PortfolioLightbox
        visible={lightboxVisible}
        urls={portfolioUrls}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxVisible(false)}
      />
      <FeedbackButton />
    </>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },

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
  sectionLabel: { marginBottom: Spacing.sm },
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

  // Portfolio grid (shared)
  portfolioViewWrap: {
    padding: Spacing.lg,
    marginHorizontal: -Spacing.lg,
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
  changePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
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

  // 3-dots menu
  menuBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  // Dropdown menu styles
  menuDismiss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 98,
  },
  dropdown: {
    position: "absolute",
    top: Layout.headerHeight,
    right: Spacing.xl,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    minWidth: 160,
    zIndex: 999,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  dropdownText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  dropdownDivider: {
    height: 0.5,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.grey100,
  },
  cityName: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  cityNameSelected: { fontFamily: FontFamily.medium },
  completionWrap: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    backgroundColor: Colors.greenLight,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.green,
  },
  completionHeader: {
    marginBottom: Spacing.md,
  },
  completionTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.greenDark,
    marginBottom: Spacing.xs,
  },
  completionSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.green,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.green,
    borderRadius: Radius.full,
  },
  completionItems: {
    gap: Spacing.xs,
  },
  completionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  completionItemIcon: {
    fontSize: 12,
    color: Colors.green,
  },
  completionItemText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.greenDark,
  },

  // Reviews
  reviewsHeaderRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  reviewCountBadge: {
    backgroundColor: Colors.grey100,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginTop: -8,
  },
  reviewCountText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.grey500,
  },
  seeAllBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
  },
  seeAllBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  noReviewsWrap: {
    backgroundColor: Colors.grey100,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: "center" as const,
  },
  noReviewsText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    textAlign: "center" as const,
    lineHeight: FontSize.sm * 1.6,
  },
  reviewSheetContainer: {
    flex: 1,
    justifyContent: "flex-end" as const,
  },
  reviewSheetOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  reviewSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "80%" as const,
    paddingTop: Spacing.md,
  },
  reviewSheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: Colors.grey200,
    borderRadius: Radius.full,
    alignSelf: "center" as const,
    marginBottom: Spacing.md,
  },
  reviewSheetHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  reviewSheetTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.lg,
    color: Colors.black,
  },
  reviewSheetContent: {
    padding: Spacing.xl,
    paddingBottom: 40,
  },
  reviewItem: {
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  reviewClientRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Spacing.sm,
  },
  reviewClientInfo: {
    flex: 1,
    gap: 2,
  },
  reviewClientName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  reviewClientMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey400,
  },
  reviewNoteText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    lineHeight: FontSize.base * 1.6,
    fontStyle: "italic" as const,
  },
  reviewDivider: {
    height: 0.5,
    backgroundColor: Colors.border,
  },
});
