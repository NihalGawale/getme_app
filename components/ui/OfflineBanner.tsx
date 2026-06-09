import { View, Text, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing } from "../../constants/Spacing";

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  if (!isOffline) return null;

  return (
    <View style={s.banner}>
      <Text style={s.text}>No internet connection</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: Colors.danger,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
  },
  text: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
});
