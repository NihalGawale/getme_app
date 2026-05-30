import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  SafeAreaView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { Icons } from "../../constants/Icons";

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
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          activeOpacity={0.7}
        >
          <Text style={s.backIcon}>{Icons.back}</Text>
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
            label={startingChat ? "Opening..." : `${Icons.messages} Message`}
            onPress={startChat}
            disabled={startingChat}
            loading={startingChat}
          />
        </View>

        <Divider />

        {/* Portfolio */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Portfolio</Text>
          {profile.portfolio_urls && profile.portfolio_urls.length > 0 ? (
            <View style={s.portfolioGrid}>
              {profile.portfolio_urls.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={s.portfolioImage} />
              ))}
            </View>
          ) : (
            <View style={s.noPortfolioWrap}>
              <Text style={s.noPortfolioText}>
                No portfolio images added yet
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
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
  scrollContent: { paddingBottom: Spacing.huge },
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
  portfolioGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  portfolioImage: {
    width: "31.5%",
    aspectRatio: 1,
    borderRadius: Radius.md,
    backgroundColor: Colors.grey100,
  },
  noPortfolioWrap: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
    backgroundColor: Colors.offWhite,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.grey100,
  },
  noPortfolioText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey300,
    fontStyle: "italic",
  },
});
