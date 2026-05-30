import { View, StyleSheet, ViewStyle } from 'react-native'
import { Colors } from '../../constants/Colors'
import { Spacing } from '../../constants/Spacing'

type DividerProps = {
  style?: ViewStyle
  spacing?: number
}

export default function Divider({ style, spacing = Spacing.lg }: DividerProps) {
  return (
    <View style={[s.divider, { marginVertical: spacing }, style]} />
  )
}

const s = StyleSheet.create({
  divider: { height: 0.5, backgroundColor: Colors.border },
})
