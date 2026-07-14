import { View, Text, StyleSheet } from "react-native";
import { VIBES } from "../constants/Vibes";
import { Colors } from "../constants/Colors";
import { FontFamily, FontSize } from "../constants/Typography";
import { Spacing, Radius } from "../constants/Spacing";

// Aggregated "vibe summary" pills (emoji + label + ×count), sorted by count
// descending. Used above the reviews list on freelancer profile screens.
export function VibeSummaryPills({
  reviews,
}: {
  reviews: { vibes: string[] | null }[];
}) {
  const counts: Record<string, number> = {};
  reviews.forEach((r) => {
    (r.vibes ?? []).forEach((v) => {
      counts[v] = (counts[v] ?? 0) + 1;
    });
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <View style={s.summaryRow}>
      {entries.map(([vibeId, count]) => {
        const vibe = VIBES.find((v) => v.id === vibeId);
        if (!vibe) return null;
        return (
          <View key={vibeId} style={s.summaryPill}>
            <Text style={s.summaryEmoji}>{vibe.emoji}</Text>
            <Text style={s.summaryLabel}>{vibe.label}</Text>
            <Text style={s.summaryCount}>×{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Small vibe chips (emoji + label) rendered inside a single review item.
export function ReviewVibePills({ vibeIds }: { vibeIds: string[] | null }) {
  return (
    <View style={s.reviewRow}>
      {(vibeIds ?? []).map((vibeId) => {
        const vibe = VIBES.find((v) => v.id === vibeId);
        if (!vibe) return null;
        return (
          <View key={vibeId} style={s.reviewPill}>
            <Text style={s.reviewPillText}>
              {vibe.emoji} {vibe.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.grey100,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
  },
  summaryEmoji: { fontSize: 14 },
  summaryLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey700,
  },
  summaryCount: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.grey500,
  },
  reviewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  reviewPill: {
    backgroundColor: Colors.grey100,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  reviewPillText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey700,
  },
});
