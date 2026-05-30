import { View, StyleSheet, ViewStyle } from 'react-native'
import { Colors } from '../../constants/Colors'
import { Radius, Spacing } from '../../constants/Spacing'

type CardProps = {
  children: React.ReactNode
  style?: ViewStyle
  padding?: number
}

export default function Card({ children, style, padding = Spacing.md }: CardProps) {
  return (
    <View style={[s.card, { padding }, style]}>
      {children}
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },
})
