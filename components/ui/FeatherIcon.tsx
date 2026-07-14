// FeatherIcon.tsx
import React from "react";
import { Feather } from "@expo/vector-icons";
import { TextStyle } from "react-native";
import { Colors } from "../../constants/Colors";

interface FeatherIconProps {
  name: React.ComponentProps<typeof Feather>["name"];
  size?: number;
  color?: string;
  style?: TextStyle;
}

export default function FeatherIcon({ name, size = 20, color = Colors.black, style }: FeatherIconProps) {
  return <Feather name={name} size={size} color={color} style={style} />;
}
