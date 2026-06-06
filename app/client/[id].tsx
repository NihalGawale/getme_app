import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize, TextStyles } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import Avatar from "../../components/ui/Avatar";
import Divider from "../../components/ui/Divider";
import LoadingScreen from "../../components/ui/LoadingScreen";

type ClientProfile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  city_id: string | null;
  bio: string | null;
  looking_for: string[] | null;
  created_at: string | null;
  cities: { name: string } | null;
};

export default function ClientProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [skillNames, setSkillNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchClientProfile();
  }, [id]);

  const fetchClientProfile = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, avatar_url, city_id, bio, looking_for, created_at, cities (name)")
      .eq("id", id)
      .single();

    if (error || !data) {
      setLoading(false);
      return;
    }

    if (data.looking_for?.length) {
      const { data: skillsData } = await supabase
        .from("skills")
        .select("id, name")
        .in("id", data.looking_for);
      setSkillNames(skillsData?.map((s) => s.name) ?? []);
    }

    setClientProfile(data as ClientProfile);
    setLoading(false);
  };

  const memberSince = clientProfile?.created_at
    ? new Date(clientProfile.created_at).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      })
    : "";

  const cityName =
    clientProfile?.cities && typeof clientProfile.cities === "object"
      ? (clientProfile.cities as { name: string }).name
      : null;

  const hasBio = Boolean(clientProfile?.bio);
  const hasSkills = skillNames.length > 0;

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={Colors.black} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile top */}
        <View style={s.profileTop}>
          <Avatar
            name={clientProfile?.name}
            uri={clientProfile?.avatar_url}
            size="xl"
          />
          <Text style={s.profileName}>{clientProfile?.name ?? "—"}</Text>
          <Text style={s.profileMeta}>
            {cityName ? `${cityName} · ` : ""}
            {"Member since " + memberSince}
          </Text>
        </View>

        <Divider />

        {/* About */}
        {hasBio && (
          <View style={s.section}>
            <Text style={[TextStyles.label, s.sectionLabel]}>ABOUT</Text>
            <Text style={s.bioText}>{clientProfile!.bio}</Text>
          </View>
        )}

        {/* Looking for */}
        {hasSkills && (
          <View style={s.section}>
            <Text style={[TextStyles.label, s.sectionLabel]}>LOOKING FOR</Text>
            <View style={s.skillPills}>
              {skillNames.map((name) => (
                <View key={name} style={s.skillPill}>
                  <Text style={s.skillPillText}>{name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Empty state */}
        {!hasBio && !hasSkills && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>
              This client hasn't added profile details yet
            </Text>
          </View>
        )}

        <View style={{ height: Spacing.huge }} />
      </ScrollView>
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
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.grey100,
  },
  headerTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xl,
    color: Colors.black,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
    paddingBottom: 40,
  },

  // Profile top
  profileTop: {
    alignItems: "center",
    paddingBottom: Spacing.xl,
    gap: Spacing.xs,
  },
  profileName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xl,
    color: Colors.black,
    marginTop: Spacing.md,
  },
  profileMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey500,
    textAlign: "center",
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

  // Skill pills
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

  // Empty state
  emptyWrap: {
    paddingTop: Spacing.xxxl,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.grey400,
    fontStyle: "italic",
    textAlign: "center",
  },
});
