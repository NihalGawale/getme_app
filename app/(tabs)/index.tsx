import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  SafeAreaView,
  Image,
  RefreshControl,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";
import Avatar from "../../components/ui/Avatar";
import EmptyState from "../../components/ui/EmptyState";
import LoadingScreen from "../../components/ui/LoadingScreen";
import Card from "../../components/ui/Card";
import { Icons } from "../../constants/Icons";

type City = { id: string; name: string };
type Skill = { id: string; name: string; icon: string };
type Freelancer = {
  id: string;
  user_id: string;
  bio: string;
  skills: string[];
  portfolio_urls: string[];
  whatsapp_number: string | null;
  instagram_handle: string | null;
  users: {
    name: string;
    avatar_url: string | null;
    city_id: string;
    cities: { name: string };
  };
  skill_names: string[];
};

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCitySheet, setShowCitySheet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedCity) fetchFreelancers();
  }, [selectedCity, selectedSkill]);

  const loadInitialData = async () => {
    setLoading(true);

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

    if (profile?.city_id && citiesData) {
      const userCity = citiesData.find((c) => c.id === profile.city_id);
      if (userCity) setSelectedCity(userCity);
      else setSelectedCity(citiesData[0]);
    } else if (citiesData?.length) {
      setSelectedCity(citiesData[0]);
    }

    setLoading(false);
  };

  const fetchFreelancers = async () => {
    if (!selectedCity) return;

    let query = supabase
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
        users!inner (
          name,
          avatar_url,
          city_id,
          cities (name)
        )
      `,
      )
      .eq("is_published", true)
      .eq("users.city_id", selectedCity.id)
      .order("created_at", { ascending: false });

    if (selectedSkill) {
      query = query.contains("skills", [selectedSkill]);
    }

    const { data, error } = await query;

    if (error) {
      console.log("Fetch error:", error.message);
      return;
    }

    const enriched = (data || []).map((f) => {
      const user = Array.isArray(f.users) ? f.users[0] : f.users;
      const cities = user?.cities;
      const city = Array.isArray(cities) ? cities[0] : cities;
      return {
        ...f,
        users: { ...user, cities: city },
        skill_names: (f.skills || [])
          .map((sid: string) => skills.find((s) => s.id === sid)?.name)
          .filter(Boolean) as string[],
      };
    });

    setFreelancers(enriched as Freelancer[]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFreelancers();
    setRefreshing(false);
  }, [selectedCity, selectedSkill]);

  const filtered = freelancers.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.users?.name?.toLowerCase().includes(q) ||
      f.skill_names.some((s) => s.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Top bar */}
      <View style={s.topBar}>
        <Text style={s.logo}>
          Get<Text style={s.logoGreen}>Me</Text>
        </Text>
        <TouchableOpacity
          style={s.cityPill}
          onPress={() => setShowCitySheet(true)}
          activeOpacity={0.8}
        >
          <Text style={s.cityPillDot}>●</Text>
          <Text style={s.cityPillText}>
            {selectedCity?.name ?? "Select city"}
          </Text>
          <Text style={s.cityPillArrow}>{Icons.chevronDown}</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>{Icons.search}</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search skill or name..."
          placeholderTextColor={Colors.grey300}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={s.searchClear}>{Icons.close}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Skill filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.skillsRow}
        style={s.skillsScroll}
      >
        <TouchableOpacity
          style={[s.skillChip, !selectedSkill && s.skillChipActive]}
          onPress={() => setSelectedSkill(null)}
          activeOpacity={0.8}
        >
          <Text
            style={[s.skillChipText, !selectedSkill && s.skillChipTextActive]}
          >
            All
          </Text>
        </TouchableOpacity>
        {skills.map((skill) => (
          <TouchableOpacity
            key={skill.id}
            style={[
              s.skillChip,
              selectedSkill === skill.id && s.skillChipActive,
            ]}
            onPress={() =>
              setSelectedSkill(selectedSkill === skill.id ? null : skill.id)
            }
            activeOpacity={0.8}
          >
            <Text style={s.skillChipIcon}>{skill.icon}</Text>
            <Text
              style={[
                s.skillChipText,
                selectedSkill === skill.id && s.skillChipTextActive,
              ]}
            >
              {skill.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results header */}
      <View style={s.resultsHeader}>
        <Text style={s.resultsTitle}>Freelancers in {selectedCity?.name}</Text>
        <Text style={s.resultsCount}>{filtered.length} found</Text>
      </View>

      {/* Freelancer list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.black}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={Icons.search}
            title="No freelancers here yet"
            subtitle="Be the first to join GetMe in this city"
          />
        }
        renderItem={({ item }) => (
          <Card style={s.card}>
            <TouchableOpacity
              onPress={() => router.push(`/freelancer/${item.user_id}`)}
              activeOpacity={0.85}
            >
              {/* Card header */}
              <View style={s.cardHeader}>
                <Avatar
                  name={item.users?.name}
                  uri={item.users?.avatar_url}
                  size="md"
                />
                <View style={s.cardInfo}>
                  <Text style={s.cardName}>{item.users?.name ?? "Unknown"}</Text>
                  <Text style={s.cardMeta}>
                    {item.skill_names[0] ?? "Freelancer"} ·{" "}
                    {item.users?.cities?.name}
                  </Text>
                </View>
              </View>

              {/* Skill tags */}
              {item.skill_names.length > 0 && (
                <View style={s.tagsRow}>
                  {item.skill_names.slice(0, 4).map((tag, i) => (
                    <View key={i} style={s.tag}>
                      <Text style={s.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Portfolio strip or no preview message */}
              {item.portfolio_urls && item.portfolio_urls.length > 0 ? (
                <View style={s.portfolioStrip}>
                  {item.portfolio_urls.slice(0, 3).map((url, i) => (
                    <Image
                      key={i}
                      source={{ uri: url }}
                      style={s.portfolioThumb}
                    />
                  ))}
                </View>
              ) : (
                <View style={s.noPreviewWrap}>
                  <Text style={s.noPreviewText}>No preview available</Text>
                </View>
              )}
            </TouchableOpacity>
          </Card>
        )}
      />

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
          <Text style={s.sheetTitle}>Browse by city</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {cities.map((city) => (
              <TouchableOpacity
                key={city.id}
                style={s.cityItem}
                onPress={() => {
                  setSelectedCity(city);
                  setShowCitySheet(false);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    s.cityName,
                    selectedCity?.id === city.id && s.cityNameSelected,
                  ]}
                >
                  {city.name}
                </Text>
                {selectedCity?.id === city.id && (
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

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  logo: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.xxl,
    color: Colors.black,
    letterSpacing: -0.5,
  },
  logoGreen: { color: Colors.green },
  cityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.grey100,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  cityPillDot: { fontSize: 8, color: Colors.green },
  cityPillText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.black,
  },
  cityPillArrow: { fontSize: FontSize.xs, color: Colors.grey500 },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.grey100,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: Spacing.sm,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  searchIcon: { fontSize: FontSize.base },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.black,
  },
  searchClear: { fontSize: 12, color: Colors.grey500, padding: 2 },

  // Skills
  skillsScroll: { maxHeight: 44 },
  skillsRow: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.xs },
  skillChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  skillChipActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  skillChipIcon: { fontSize: 12 },
  skillChipText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.grey500,
  },
  skillChipTextActive: { color: Colors.white },

  // Results header
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  resultsTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.md,
    color: Colors.black,
  },
  resultsCount: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
  },

  // List
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: 10 },

  // Card
  card: { padding: Spacing.md },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: Spacing.sm,
  },
  cardInfo: { flex: 1 },
  cardName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.black,
    marginBottom: 2,
  },
  cardMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
  },

  // Tags
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: Spacing.sm },
  tag: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  tagText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey500,
  },

  // Portfolio
  portfolioStrip: { flexDirection: "row", gap: 6 },
  portfolioThumb: {
    flex: 1,
    height: 60,
    borderRadius: Radius.sm,
    backgroundColor: Colors.grey100,
  },

  // No preview
  noPreviewWrap: {
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: Colors.offWhite,
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    borderColor: Colors.grey100,
  },
  noPreviewText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey300,
    fontStyle: "italic",
  },

  // City sheet
  overlay: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Spacing.xl,
    borderTopRightRadius: Spacing.xl,
    padding: Spacing.lg,
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
    fontSize: FontSize.md,
    color: Colors.green,
    fontFamily: FontFamily.medium,
  },
});
