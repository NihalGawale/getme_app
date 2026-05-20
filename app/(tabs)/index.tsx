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
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

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

    // Load cities and skills in parallel
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

    // Set default city from user profile
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

    // Enrich with skill names
    const enriched = (data || []).map((f) => ({
      ...f,
      skill_names: (f.skills || [])
        .map((sid: string) => skills.find((s) => s.id === sid)?.name)
        .filter(Boolean) as string[],
    }));

    setFreelancers(enriched);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFreelancers();
    setRefreshing(false);
  }, [selectedCity, selectedSkill]);

  // Filter by search query
  const filtered = freelancers.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.users?.name?.toLowerCase().includes(q) ||
      f.skill_names.some((s) => s.toLowerCase().includes(q))
    );
  });

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
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
          <Text style={s.cityPillArrow}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search skill or name..."
          placeholderTextColor="#D0D0D0"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={s.searchClear}>✕</Text>
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
            tintColor="#111"
          />
        }
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>🔍</Text>
            <Text style={s.emptyTitle}>No freelancers found</Text>
            <Text style={s.emptyText}>Try a different skill or city</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => router.push(`/freelancer/${item.user_id}`)}
            activeOpacity={0.85}
          >
            {/* Card header */}
            <View style={s.cardHeader}>
              {item.users?.avatar_url ? (
                <Image
                  source={{ uri: item.users.avatar_url }}
                  style={s.avatar}
                />
              ) : (
                <View style={s.avatarFallback}>
                  <Text style={s.avatarText}>
                    {getInitials(item.users?.name ?? "")}
                  </Text>
                </View>
              )}
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
                  <Text style={s.cityCheck}>✓</Text>
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
  container: { flex: 1, backgroundColor: "#fff" },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  logo: {
    fontFamily: "System",
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
    letterSpacing: -0.5,
  },
  logoGreen: { color: "#1D9E75" },
  cityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F4F4F4",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
  },
  cityPillDot: { fontSize: 8, color: "#1D9E75" },
  cityPillText: { fontSize: 12, fontWeight: "500", color: "#111" },
  cityPillArrow: { fontSize: 10, color: "#6B6B68" },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#F4F4F4",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 13, color: "#111" },
  searchClear: { fontSize: 12, color: "#6B6B68", padding: 2 },

  // Skills
  skillsScroll: { maxHeight: 44 },
  skillsRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  skillChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    backgroundColor: "#fff",
  },
  skillChipActive: { backgroundColor: "#111", borderColor: "#111" },
  skillChipIcon: { fontSize: 12 },
  skillChipText: { fontSize: 12, fontWeight: "500", color: "#6B6B68" },
  skillChipTextActive: { color: "#fff" },

  // Results header
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultsTitle: { fontSize: 13, fontWeight: "500", color: "#111" },
  resultsCount: { fontSize: 11, color: "#6B6B68" },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },

  // Card
  card: {
    backgroundColor: "#fff",
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    borderRadius: 16,
    padding: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F4F4F4",
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "500", color: "#111" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: "500", color: "#111", marginBottom: 2 },
  cardMeta: { fontSize: 11, color: "#6B6B68" },

  // Tags
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 8 },
  tag: {
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 10, color: "#6B6B68" },

  // Portfolio
  portfolioStrip: { flexDirection: "row", gap: 6 },
  portfolioThumb: {
    flex: 1,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#F4F4F4",
  },

  // No preview
  noPreviewWrap: {
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#F0F0F0",
  },
  noPreviewText: { fontSize: 11, color: "#D0D0D0", fontStyle: "italic" },

  // Empty state
  emptyWrap: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "500", color: "#111" },
  emptyText: { fontSize: 13, color: "#6B6B68" },

  // City sheet
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "60%",
  },
  sheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: "#E8E8E8",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111",
    marginBottom: 12,
  },
  cityItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F4F4F4",
  },
  cityName: { fontSize: 14, color: "#111" },
  cityNameSelected: { fontWeight: "500" },
  cityCheck: { fontSize: 13, color: "#1D9E75", fontWeight: "500" },
});
