import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";
import Button from "../../components/ui/Button";
import FeatherIcon from "../../components/ui/FeatherIcon";

const roles = [
  {
    id: "client",
    title: "I need to hire talent",
    sub: "Find skilled people in my city for projects",
    icon: <FeatherIcon name="search" size={22} color="black" />,
  },
  {
    id: "freelancer",
    title: "I'm a freelancer",
    sub: "Showcase my skills and get discovered by clients",
    icon: <FeatherIcon name="briefcase" size={22} color="black" />,
  },
  {
    id: "both",
    title: "Both",
    sub: "I hire people and also offer my own skills",
    icon: <FeatherIcon name="users" size={22} color="black" />,
  },
];

export default function RoleScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = () => {
    if (!selected) return;
    const role = selected === "both" ? "freelancer" : selected;
    router.push({ pathname: "/(auth)/phone", params: { role } });
  };

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
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
              {r.icon}
            </View>
            <View style={s.cardInfo}>
              <Text style={s.cardTitle}>{r.title}</Text>
              <Text style={s.cardSub}>{r.sub}</Text>
            </View>
            <View style={[s.check, selected === r.id && s.checkSelected]}>
              {selected === r.id && (
                <FeatherIcon name="check" size={14} color="white" style={s.checkIcon} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
      <Button
        label="Continue"
        onPress={handleContinue}
        disabled={!selected}
        style={s.continueBtn}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 56,
    paddingBottom: 40,
  },
  progress: { flexDirection: "row", gap: Spacing.xs, marginBottom: 28 },
  bar: { flex: 1, height: 3, borderRadius: Radius.full, backgroundColor: Colors.grey200 },
  barActive: { backgroundColor: Colors.black },
  title: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xl,
    color: Colors.black,
    marginBottom: Spacing.sm,
  },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey500,
    marginBottom: Spacing.xxl,
    lineHeight: 20,
  },
  cards: { gap: 10, flex: 1 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.grey200,
    borderRadius: Radius.lg,
    padding: Layout.cardPadding,
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: Colors.black,
    backgroundColor: Colors.grey100,
  },
  cardIcon: {
    width: Layout.avatarMd,
    height: Layout.avatarMd,
    borderRadius: Radius.md,
    backgroundColor: Colors.grey100,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconSelected: { backgroundColor: Colors.black },
  cardInfo: { flex: 1 },
  cardTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.black,
    marginBottom: 2,
  },
  cardSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    lineHeight: 16,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.grey200,
    alignItems: "center",
    justifyContent: "center",
  },
  checkSelected: { backgroundColor: Colors.black, borderColor: Colors.black },
  checkIcon: { color: Colors.white, fontSize: FontSize.sm },
  continueBtn: { marginTop: Spacing.lg },
});
