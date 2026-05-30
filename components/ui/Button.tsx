import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native'
import { Colors } from '../../constants/Colors'
import { FontFamily, FontSize } from '../../constants/Typography'
import { Radius, Spacing } from '../../constants/Spacing'

type ButtonProps = {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      style={[
        s.base,
        variant === 'primary' && s.primary,
        variant === 'secondary' && s.secondary,
        variant === 'ghost' && s.ghost,
        variant === 'danger' && s.danger,
        isDisabled && s.disabled,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? Colors.white : Colors.black} size="small" />
      ) : (
        <Text style={[
          s.label,
          variant === 'primary' && s.labelPrimary,
          variant === 'secondary' && s.labelSecondary,
          variant === 'ghost' && s.labelGhost,
          variant === 'danger' && s.labelDanger,
        ]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  primary: { backgroundColor: Colors.black },
  secondary: { backgroundColor: Colors.white, borderWidth: 0.5, borderColor: Colors.border },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: Colors.dangerLight, borderWidth: 0.5, borderColor: Colors.danger },
  disabled: { opacity: 0.4 },
  label: { fontFamily: FontFamily.medium, fontSize: FontSize.base },
  labelPrimary: { color: Colors.white },
  labelSecondary: { color: Colors.black },
  labelGhost: { color: Colors.black },
  labelDanger: { color: Colors.danger },
})
