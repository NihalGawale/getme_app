import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";
import Button from "../../components/ui/Button";
import FeatherIcon from "../../components/ui/FeatherIcon";
import AuthScreenHeader from "../../components/AuthScreenHeader";

export default function RoleScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const canContinue = selected !== null && agreedToTerms;

  const roles = [
    {
      id: "client",
      title: "I really need a great talent",
      sub: "Looking to hire",
      icon: (
        <FeatherIcon
          name="search"
          size={22}
          color={selected === "client" ? Colors.white : Colors.black}
        />
      ),
    },
    {
      id: "freelancer",
      title: "I'm the talent you need",
      sub: "Looking for work",
      icon: (
        <FeatherIcon
          name="briefcase"
          size={22}
          color={selected === "freelancer" ? Colors.white : Colors.black}
        />
      ),
    },
  ];

  const handleContinue = () => {
    if (!canContinue) return;
    router.push({ pathname: "/(auth)/phone", params: { role: selected } });
  };

  return (
    <AuthScreenHeader
      step={1}
      title="What brings you to GetMe?"
      subtitle="We'll set up your experience based on this."
    >
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
                <FeatherIcon
                  name="check"
                  size={14}
                  color="white"
                  style={s.checkIcon}
                />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={s.consentRow}
        onPress={() => setAgreedToTerms(!agreedToTerms)}
        activeOpacity={0.7}
      >
        <View style={[s.checkbox, agreedToTerms && s.checkboxChecked]}>
          {agreedToTerms && (
            <FeatherIcon name="check" size={12} color={Colors.white} />
          )}
        </View>
        <Text style={s.consentText}>
          I agree to GetMe's{" "}
          <Text
            style={s.consentLink}
            onPress={(e) => {
              e.stopPropagation();
              Linking.openURL("https://getme.social/privacy");
            }}
          >
            Privacy Policy
          </Text>{" "}
          and{" "}
          <Text
            style={s.consentLink}
            onPress={(e) => {
              e.stopPropagation();
              Linking.openURL("https://getme.social/terms");
            }}
          >
            Terms of Use
          </Text>{" "}
        </Text>
      </TouchableOpacity>
      <Button
        label="Continue"
        onPress={handleContinue}
        disabled={!canContinue}
        style={s.continueBtn}
      />
    </AuthScreenHeader>
  );
}

const s = StyleSheet.create({
  cards: { gap: 10, flex: 1 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.grey200,
    alignItems: "center",
    justifyContent: "center",
  },
  checkSelected: { backgroundColor: Colors.black, borderColor: Colors.black },
  checkIcon: { color: Colors.white, fontSize: FontSize.sm },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: Colors.black,
    borderColor: Colors.black,
  },
  consentText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    lineHeight: FontSize.sm * 1.5,
  },
  consentLink: {
    fontFamily: FontFamily.medium,
    color: Colors.black,
    textDecorationLine: "underline",
  },
  continueBtn: { marginTop: Spacing.lg },
});
