import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";

const roles = [
  {
    id: "client",
    title: "I need to hire talent",
    sub: "Find skilled people in my city for projects",
    icon: "🔍",
  },
  {
    id: "freelancer",
    title: "I'm a freelancer",
    sub: "Showcase my skills and get discovered by clients",
    icon: "💼",
  },
  {
    id: "both",
    title: "Both",
    sub: "I hire people and also offer my own skills",
    icon: "👥",
  },
];

export default function RoleScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = () => {
    if (!selected) return;
    const role = selected === "both" ? "freelancer" : selected;
    // Pass role to phone screen as a param
    router.push({ pathname: "/(auth)/phone", params: { role } });
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={s.progress}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[s.bar, i === 0 && s.barActive]} />
        ))}
      </View>
      <Text style={s.title}>What brings you to GetMe?</Text>
      <Text style={s.sub}>We'll set up your experience based on this.</Text>
      <View style={s.cards}>
        {roles.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[s.card, selected === r.id && s.cardSelected]}
            onPress={() => setSelected(r.id)}
            activeOpacity={0.8}
          >
            <View style={[s.cardIcon, selected === r.id && s.cardIconSelected]}>
              <Text style={{ fontSize: 20 }}>{r.icon}</Text>
            </View>
            <View style={s.cardInfo}>
              <Text style={s.cardTitle}>{r.title}</Text>
              <Text style={s.cardSub}>{r.sub}</Text>
            </View>
            <View style={[s.check, selected === r.id && s.checkSelected]}>
              {selected === r.id && (
                <Text style={{ color: "#fff", fontSize: 11 }}>✓</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[s.btnPrimary, !selected && s.btnDisabled]}
        onPress={handleContinue}
        activeOpacity={0.85}
        disabled={!selected}
      >
        <Text style={s.btnText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  progress: { flexDirection: "row", gap: 4, marginBottom: 28 },
  bar: { flex: 1, height: 3, borderRadius: 99, backgroundColor: "#E8E8E8" },
  barActive: { backgroundColor: "#111" },
  title: { fontSize: 20, fontWeight: "500", color: "#111", marginBottom: 8 },
  sub: { fontSize: 13, color: "#6B6B68", marginBottom: 24, lineHeight: 20 },
  cards: { gap: 10, flex: 1 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    borderRadius: 16,
    padding: 14,
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: "#111",
    backgroundColor: "#F8F8F8",
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconSelected: { backgroundColor: "#111" },
  cardInfo: { flex: 1 },
  cardTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111",
    marginBottom: 2,
  },
  cardSub: { fontSize: 11, color: "#6B6B68", lineHeight: 16 },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  checkSelected: { backgroundColor: "#111", borderColor: "#111" },
  btnPrimary: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 14, fontWeight: "500", color: "#fff" },
});
