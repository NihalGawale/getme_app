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
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Divider from "../../components/ui/Divider";
import EmptyState from "../../components/ui/EmptyState";
import LoadingScreen from "../../components/ui/LoadingScreen";
import { VIBES } from "../../constants/Vibes";
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  clamp,
} from "react-native-reanimated";

type City = { id: string; name: string };
type Skill = { id: string; name: string; icon: string };

const GRID_SIZE = Math.floor(
  (Dimensions.get("window").width - Spacing.lg * 2 - 4) / 3,
);
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

// ─── Cloudinary upload ────────────────────────────────────────────────────────

const uploadToCloudinary = async (uri: string): Promise<string | null> => {
  try {
    console.log("Starting Cloudinary upload...");
    console.log("Cloud name:", process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME);

    const formData = new FormData();
    formData.append("file", {
      uri,
      type: "image/jpeg",
      name: "upload.jpg",
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
    console.log("Cloudinary response:", JSON.stringify(data));

    return data.secure_url ?? null;
  } catch (e) {
    console.log("Cloudinary upload error:", e);
    return null;
  }
};

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function LightboxImage({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, 1, 4);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
    });

  const composed = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture,
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureHandlerRootView style={{ width, height }}>
      <GestureDetector gesture={composed}>
        <Animated.View
          style={{
            width,
            height,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Animated.Image
            source={{ uri }}
            style={[{ width, height }, animatedStyle]}
            resizeMode="contain"
          />
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
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
  const [originalData, setOriginalData] = useState<any>(null);

  // Lookup data
  const [cities, setCities] = useState<City[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showCitySheet, setShowCitySheet] = useState(false);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);

  // Reviews
  const [myReviews, setMyReviews] = useState<any[]>([]);
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
    const { data, error } = await supabase
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
    console.log("My reviews:", data?.length, error?.message);
    if (data) setMyReviews(data as any);
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
    if (profile?.role !== "client") setPortfolioUrls(originalData.pu);
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
  const memberSince = userCreatedAt
    ? new Date(userCreatedAt).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      })
    : null;

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
          <Text
            style={
              selectedCity ? s.citySelectorText : s.citySelectorPlaceholder
            }
          >
            {selectedCity?.name ?? "Select city"}
          </Text>
          <Feather name="chevron-down" size={14} color={Colors.grey500} />
        </TouchableOpacity>

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
                <Text
                  style={[s.skillTileName, active && s.skillTileNameActive]}
                >
                  {skill.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
      <View style={s.section}>
        <Text style={[TextStyles.label, s.sectionLabel]}>ABOUT</Text>
        {bio ? (
          <Text style={s.bioText}>{bio}</Text>
        ) : (
          <Text style={s.emptyFieldText}>
            Add a bio to tell freelancers about yourself
          </Text>
        )}
      </View>

      {/* Looking for */}
      <View style={s.section}>
        <Text style={[TextStyles.label, s.sectionLabel]}>LOOKING FOR</Text>
        {skillObjects.length > 0 ? (
          <View style={s.skillPills}>
            {skillObjects.map((skill) => (
              <View key={skill.id} style={s.skillPill}>
                <Text style={s.skillPillText}>{skill.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.emptyFieldText}>
            Add the skills you frequently need
          </Text>
        )}
      </View>

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
          <Text
            style={
              selectedCity ? s.citySelectorText : s.citySelectorPlaceholder
            }
          >
            {selectedCity?.name ?? "Select city"}
          </Text>
          <Feather name="chevron-down" size={14} color={Colors.grey500} />
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
                <Text
                  style={[s.skillTileName, active && s.skillTileNameActive]}
                >
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
                <Feather name="x" size={12} color={Colors.white} />
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
                <Feather name="plus" size={24} color={Colors.grey400} />
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
        {selectedCity && <Text style={s.profileCity}>{selectedCity.name}</Text>}
      </View>

      <Divider />

      {/* About */}
      <View style={s.section}>
        <Text style={[TextStyles.label, s.sectionLabel]}>About</Text>
        {bio ? (
          <Text style={s.bioText}>{bio}</Text>
        ) : (
          <Text style={s.emptyFieldText}>
            Add a bio to tell clients about yourself
          </Text>
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
          <View style={s.vibeSummaryRow}>
            {(() => {
              const counts: Record<string, number> = {};
              myReviews.forEach((r) => {
                (r.vibes ?? []).forEach((v: string) => {
                  counts[v] = (counts[v] ?? 0) + 1;
                });
              });
              return Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .map(([vibeId, count]) => {
                  const vibe = VIBES.find((v) => v.id === vibeId);
                  if (!vibe) return null;
                  return (
                    <View key={vibeId} style={s.vibePill}>
                      <Text style={s.vibePillEmoji}>{vibe.emoji}</Text>
                      <Text style={s.vibePillLabel}>{vibe.label}</Text>
                      <Text style={s.vibePillCount}>×{count}</Text>
                    </View>
                  );
                });
            })()}
          </View>

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
                  { width: `${completion.percentage}%` as any },
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
            <View style={s.portfolioGrid}>
              {portfolioUrls.map((url, i) => (
                <TouchableOpacity
                  key={i}
                  style={s.portfolioCell}
                  onPress={() => {
                    setLightboxIndex(i);
                    setLightboxVisible(true);
                  }}
                  activeOpacity={0.9}
                >
                  <Image source={{ uri: url }} style={s.portfolioImage} />
                </TouchableOpacity>
              ))}
            </View>
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
                        uri={(review as any).users?.avatar_url}
                        name={(review as any).users?.name}
                        size="sm"
                      />
                      <View style={s.reviewClientInfo}>
                        <Text style={s.reviewClientName}>
                          {(review as any).users?.name ?? "Client"}
                        </Text>
                        <Text style={s.reviewClientMeta}>
                          {(review as any).users?.cities?.name ?? ""}
                          {(review as any).users?.cities?.name ? " · " : ""}
                          {new Date(review.created_at).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </Text>
                      </View>
                    </View>
                    <View style={s.reviewVibesRow}>
                      {(review.vibes ?? []).map((vibeId: string) => {
                        const vibe = VIBES.find((v) => v.id === vibeId);
                        if (!vibe) return null;
                        return (
                          <View key={vibeId} style={s.reviewVibePill}>
                            <Text style={s.reviewVibePillText}>
                              {vibe.emoji} {vibe.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
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

      <Modal
        visible={lightboxVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxVisible(false)}
        statusBarTranslucent
      >
        <View style={s.lightboxContainer}>
          <View style={s.lightboxOverlay} />

          <View style={s.lightboxCounter}>
            <Text style={s.lightboxCounterText}>
              {lightboxIndex + 1} / {portfolioUrls.length}
            </Text>
          </View>

          <TouchableOpacity
            style={s.lightboxClose}
            onPress={() => setLightboxVisible(false)}
            activeOpacity={0.7}
          >
            <Feather name="x" size={24} color={Colors.white} />
          </TouchableOpacity>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            contentOffset={{ x: lightboxIndex * SCREEN_WIDTH, y: 0 }}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(
                e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
              );
              setLightboxIndex(index);
            }}
            style={s.lightboxScroll}
          >
            {portfolioUrls.map((url, i) => (
              <LightboxImage
                key={i}
                uri={url}
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
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

  // Skill pills (view mode)
  skillPills: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  skillPill: {
    borderWidth: StyleSheet.hairlineWidth,
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
  portfolioViewWrap: {
    padding: Spacing.lg,
    marginHorizontal: -Spacing.lg,
  },
  portfolioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
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
  chevron: { width: 14 }, // kept as spacer placeholder

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
  removeBtnText: { fontSize: 10, color: Colors.white }, // unused — Feather icon used
  addCell: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    backgroundColor: Colors.grey100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  addCellIcon: { fontSize: 24, color: Colors.grey400 }, // unused — Feather icon used

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
    borderBottomWidth: StyleSheet.hairlineWidth,
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

  // Sign out (client view only)
  signOutRow: {
    paddingVertical: 16,
    alignItems: "center",
  },
  signOutText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.danger,
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
    top: 52, // height of header row
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
  cityCheck: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.md,
    color: Colors.green,
  },
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
  vibeSummaryRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  vibePill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Spacing.xs,
    backgroundColor: Colors.grey100,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
  },
  vibePillEmoji: { fontSize: 14 },
  vibePillLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey700,
  },
  vibePillCount: {
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
    maxHeight: "80%" as any,
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
  reviewVibesRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: Spacing.xs,
  },
  reviewVibePill: {
    backgroundColor: Colors.grey100,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  reviewVibePillText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey700,
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

  // Lightbox
  lightboxContainer: {
    flex: 1,
    backgroundColor: Colors.overlayDark,
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlayDark,
  },
  lightboxCounter: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  lightboxCounterText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.white,
    opacity: 0.8,
  },
  lightboxClose: {
    position: "absolute",
    top: 52,
    right: Spacing.xl,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: Radius.full,
  },
  lightboxScroll: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
});
