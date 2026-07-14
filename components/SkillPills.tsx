import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../constants/Colors";
import { FontFamily, FontSize } from "../constants/Typography";
import { Spacing, Radius } from "../constants/Spacing";

// Read-only pill list for a set of skill names — used on freelancer/client
// profile screens (skills / "looking for").
export default function SkillPills({ skills }: { skills: string[] }) {
  return (
    <View style={s.row}>
      {skills.map((name, i) => (
        <View key={i} style={s.pill}>
          <Text style={s.text}>{name}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  text: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.black,
  },
});
