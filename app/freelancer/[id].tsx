import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

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

    // Fetch skill names
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

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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

    // Prevent freelancer from chatting with themselves
    if (user.id === profile.user_id) {
      Alert.alert("This is your profile", "You cannot message yourself.");
      return;
    }

    setStartingChat(true);

    // Check if conversation already exists
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

    // Create new conversation
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
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={s.loadingWrap}>
        <Text style={s.errorText}>Profile not found</Text>
      </View>
    );
  }

  const hasContact = !!(
    profile.whatsapp_number ||
    profile.instagram_handle ||
    profile.contact_phone
  );

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          activeOpacity={0.7}
        >
          <Text style={s.backIcon}>←</Text>
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
          {profile.users?.avatar_url ? (
            <Image
              source={{ uri: profile.users.avatar_url }}
              style={s.avatar}
            />
          ) : (
            <View style={s.avatarFallback}>
              <Text style={s.avatarText}>
                {getInitials(profile.users?.name ?? "")}
              </Text>
            </View>
          )}
          <Text style={s.name}>{profile.users?.name}</Text>
          <Text style={s.location}>
            {profile.skill_names[0] ?? "Freelancer"} ·{" "}
            {profile.users?.cities?.name}
          </Text>
        </View>

        <View style={s.divider} />

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
          <TouchableOpacity
            style={s.btnPrimary}
            onPress={startChat}
            activeOpacity={0.85}
            disabled={startingChat}
          >
            <Text style={s.btnPrimaryText}>
              {startingChat ? "Opening..." : "💬 Message"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={s.divider} />

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
  container: { flex: 1, backgroundColor: "#fff" },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  errorText: { fontSize: 16, color: "#6B6B68" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { fontSize: 20, color: "#111" },
  headerTitle: { fontSize: 15, fontWeight: "500", color: "#111" },

  // Profile top
  scrollContent: { paddingBottom: 40 },
  profileTop: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F4F4F4",
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 24, fontWeight: "500", color: "#111" },
  name: { fontSize: 20, fontWeight: "500", color: "#111", marginBottom: 4 },
  location: { fontSize: 13, color: "#6B6B68" },

  divider: { height: 0.5, backgroundColor: "#F0F0F0", marginHorizontal: 16 },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#6B6B68",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  // Bio
  bioText: { fontSize: 14, color: "#111", lineHeight: 22 },

  // Skills
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: { fontSize: 12, color: "#111" },

  // Contact buttons
  contactSection: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  contactButtons: { gap: 10 },
  btnPrimary: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnPrimaryText: { fontSize: 14, fontWeight: "500", color: "#fff" },
  btnSecondary: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
  },
  btnSecondaryText: { fontSize: 14, fontWeight: "500", color: "#111" },

  // Portfolio
  portfolioGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  portfolioImage: {
    width: "31.5%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: "#F4F4F4",
  },
  noPortfolioWrap: {
    paddingVertical: 20,
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "#F0F0F0",
  },
  noPortfolioText: { fontSize: 13, color: "#D0D0D0", fontStyle: "italic" },
});
