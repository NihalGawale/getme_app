import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
  Dimensions,
  Modal,
  PanResponder,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";
import Avatar from "../../components/ui/Avatar";
import Button from "../../components/ui/Button";
import LoadingScreen from "../../components/ui/LoadingScreen";
import Divider from "../../components/ui/Divider";
import { TextStyles } from "../../constants/Typography";
import FeatherIcon from "../../components/ui/FeatherIcon";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 4) / 3);

function LightboxImage({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);
  const initialDistance = useRef<number | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        lastTranslateX.current = (translateX as any)._value;
        lastTranslateY.current = (translateY as any)._value;
      },

      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;

        if (touches.length === 2) {
          const touch1 = touches[0];
          const touch2 = touches[1];
          const distance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) +
              Math.pow(touch2.pageY - touch1.pageY, 2),
          );

          if (initialDistance.current !== null) {
            const newScale = Math.max(
              1,
              Math.min(4, lastScale.current * (distance / initialDistance.current)),
            );
            scale.setValue(newScale);
          } else {
            initialDistance.current = distance;
          }
        } else if (touches.length === 1 && lastScale.current > 1) {
          translateX.setValue(lastTranslateX.current + gestureState.dx);
          translateY.setValue(lastTranslateY.current + gestureState.dy);
        }
      },

      onPanResponderRelease: () => {
        const currentScale = (scale as any)._value;
        lastScale.current = currentScale;
        lastTranslateX.current = (translateX as any)._value;
        lastTranslateY.current = (translateY as any)._value;
        initialDistance.current = null;

        if (currentScale < 1) {
          Animated.parallel([
            Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
          ]).start();
          lastScale.current = 1;
          lastTranslateX.current = 0;
          lastTranslateY.current = 0;
        }
      },
    }),
  ).current;

  return (
    <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
      <Animated.Image
        source={{ uri }}
        style={{
          width,
          height,
          transform: [{ scale }, { translateX }, { translateY }],
        }}
        resizeMode="contain"
        {...panResponder.panHandlers}
      />
    </View>
  );
}

type FreelancerProfile = {
  id: string;
  user_id: string;
  bio: string;
  skills: string[];
  portfolio_urls: string[];
  whatsapp_number: string | null;
  instagram_handle: string | null;
  contact_phone: string | null;
  users: {
    name: string;
    avatar_url: string | null;
    cities: { name: string };
  };
  skill_names: string[];
};

export default function FreelancerProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<FreelancerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (id) fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("freelancer_profiles")
      .select(
        `
        id,
        user_id,
        bio,
        skills,
        portfolio_urls,
        whatsapp_number,
        instagram_handle,
        contact_phone,
        users!inner (
          name,
          avatar_url,
          cities (name)
        )
      `,
      )
      .eq("user_id", id)
      .single();

    console.log('Profile data:', JSON.stringify(data));
    console.log('Portfolio URLs:', data?.portfolio_urls);
    console.log('Error:', error?.message);

    console.log('Profile data:', JSON.stringify(data));
    console.log('Portfolio URLs:', data?.portfolio_urls);
    console.log('Error:', error?.message);

    if (error) {
      console.log("Profile fetch error:", error.message);
      setLoading(false);
      return;
    }

    const { data: skillsData } = await supabase
      .from("skills")
      .select("id, name")
      .in("id", data.skills || []);

    const users = Array.isArray(data.users) ? data.users[0] : data.users;
    const cities = users?.cities;
    const city = Array.isArray(cities) ? cities[0] : cities;

    setProfile({
      ...data,
      users: { ...users, cities: city },
      skill_names: (skillsData || []).map((s) => s.name),
    } as FreelancerProfile);
    setLoading(false);
  };

  const openWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    const url = `https://wa.me/91${cleaned}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Could not open WhatsApp"),
    );
  };

  const openInstagram = (handle: string) => {
    const cleaned = handle.replace("@", "");
    const appUrl = `instagram://user?username=${cleaned}`;
    const webUrl = `https://instagram.com/${cleaned}`;
    Linking.canOpenURL(appUrl).then((supported) => {
      Linking.openURL(supported ? appUrl : webUrl).catch(() =>
        Alert.alert("Error", "Could not open Instagram"),
      );
    });
  };

  const startChat = async () => {
    if (!user || !profile) return;

    if (user.id === profile.user_id) {
      Alert.alert("This is your profile", "You cannot message yourself.");
      return;
    }

    setStartingChat(true);

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("client_id", user.id)
      .eq("freelancer_id", profile.user_id)
      .single();

    if (existing) {
      setStartingChat(false);
      router.push(`/chat/${existing.id}`);
      return;
    }

    const { data: newConvo, error } = await supabase
      .from("conversations")
      .insert({
        client_id: user.id,
        freelancer_id: profile.user_id,
      })
      .select("id")
      .single();

    setStartingChat(false);

    if (error) {
      Alert.alert("Error", "Could not start conversation.");
      return;
    }

    router.push(`/chat/${newConvo.id}`);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!profile) {
    return (
      <View style={s.loadingWrap}>
        <Text style={s.errorText}>Profile not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          activeOpacity={0.7}
        >
          <FeatherIcon name="arrow-left" size={24} color="black" style={s.backIcon} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {/* Avatar + name */}
        <View style={s.profileTop}>
          <Avatar
            name={profile.users?.name}
            uri={profile.users?.avatar_url}
            size="xl"
          />
          <Text style={s.name}>{profile.users?.name}</Text>
          <Text style={s.location}>
            {profile.skill_names[0] ?? "Freelancer"} ·{" "}
            {profile.users?.cities?.name}
          </Text>
        </View>

        <Divider />

        {/* Bio */}
        {profile.bio ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>About</Text>
            <Text style={s.bioText}>{profile.bio}</Text>
          </View>
        ) : null}

        {/* Skills */}
        {profile.skill_names.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Skills</Text>
            <View style={s.tagsRow}>
              {profile.skill_names.map((skill, i) => (
                <View key={i} style={s.tag}>
                  <Text style={s.tagText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Contact buttons */}
        <View style={s.contactSection}>
          <Button
            label={startingChat ? "Opening..." : "Message"}
            onPress={startChat}
            disabled={startingChat}
            loading={startingChat}
            leftIcon={<FeatherIcon name="message-circle" size={18} color="white" />}
          />
        </View>

        <Divider />

        {/* Portfolio */}
        <View style={s.portfolioSection}>
          {profile.portfolio_urls && profile.portfolio_urls.length > 0 ? (
            <>
              <View style={{ paddingHorizontal: Layout.screenPadding, marginBottom: 10, marginTop: Spacing.sm }}>
                <Text style={[TextStyles.label, s.sectionLabel]}>Portfolio</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2, width: SCREEN_WIDTH }}>
                {profile.portfolio_urls.map((url, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      setLightboxIndex(i);
                      setLightboxVisible(true);
                    }}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: url }}
                      style={{
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        backgroundColor: Colors.grey100,
                      }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <View style={s.portfolioLabelWrap}>
              <Text style={[TextStyles.label, s.sectionLabel]}>Portfolio</Text>
              <View style={s.noPortfolio}>
                <Text style={s.noPortfolioText}>No portfolio images added yet</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

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
              {lightboxIndex + 1} / {profile.portfolio_urls.length}
            </Text>
          </View>

          <TouchableOpacity
            style={s.lightboxClose}
            onPress={() => setLightboxVisible(false)}
            activeOpacity={0.7}
          >
            <FeatherIcon name="x" size={24} color={Colors.white} />
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
            {profile.portfolio_urls.map((url, i) => (
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
  },
  errorText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.lg,
    color: Colors.grey500,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.grey100,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { fontSize: FontSize.xl, color: Colors.black },
  headerTitle: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: Colors.black,
  },

  // Profile top
  scrollContent: { paddingBottom: 100 },
  profileTop: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Layout.screenPadding,
    gap: Spacing.xs,
  },
  name: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xl,
    color: Colors.black,
    marginTop: Spacing.md,
  },
  location: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey500,
  },

  // Sections
  section: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xs,
  },
  sectionLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  // Bio
  bioText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    lineHeight: 22,
  },

  // Skills
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  tag: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  tagText: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.black,
  },

  // Contact buttons
  contactSection: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xs,
  },

  // Portfolio
  portfolioSection: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xs,
  },
  portfolioLabelWrap: {
    paddingHorizontal: Layout.screenPadding,
    marginBottom: Spacing.xs,
  },
  noPortfolio: {
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.xl,
    alignItems: "center" as const,
  },
  noPortfolioText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey300,
    fontStyle: "italic" as const,
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
