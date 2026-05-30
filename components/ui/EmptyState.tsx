import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '../../constants/Colors'
import { FontFamily, FontSize } from '../../constants/Typography'
import { Spacing } from '../../constants/Spacing'
import Button from './Button'

type EmptyStateProps = {
  icon: string
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={s.container}>
      <Text style={s.icon}>{icon}</Text>
      <Text style={s.title}>{title}</Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          style={s.action}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.sm },
  icon: { fontSize: 40, marginBottom: Spacing.sm },
  title: { fontFamily: FontFamily.medium, fontSize: FontSize.lg, color: Colors.black, textAlign: 'center' },
  subtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.md, color: Colors.grey500, textAlign: 'center', lineHeight: FontSize.md * 1.6 },
  action: { marginTop: Spacing.lg, paddingHorizontal: Spacing.xxl },
})
