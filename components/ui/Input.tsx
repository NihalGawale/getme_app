import { TextInput, View, Text, StyleSheet, TextInputProps } from 'react-native'
import { Colors } from '../../constants/Colors'
import { FontFamily, FontSize } from '../../constants/Typography'
import { Radius, Spacing } from '../../constants/Spacing'

type InputProps = TextInputProps & {
  label?: string
  prefix?: string
  required?: boolean
  hint?: string
  error?: string
}

export default function Input({
  label,
  prefix,
  required,
  hint,
  error,
  style,
  ...props
}: InputProps) {
  return (
    <View style={s.wrapper}>
      {label && (
        <Text style={s.label}>
          {label}
          {required && <Text style={s.required}> *</Text>}
        </Text>
      )}
      <View style={[s.inputRow, error && s.inputError]}>
        {prefix && <Text style={s.prefix}>{prefix}</Text>}
        <TextInput
          style={[s.input, style]}
          placeholderTextColor={Colors.grey300}
          {...props}
        />
      </View>
      {hint && !error && <Text style={s.hint}>{hint}</Text>}
      {error && <Text style={s.errorText}>{error}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  wrapper: { gap: Spacing.xs },
  label: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.grey500, textTransform: 'uppercase', letterSpacing: 0.6 },
  required: { color: Colors.danger },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 48, backgroundColor: Colors.white },
  inputError: { borderColor: Colors.danger },
  prefix: { fontFamily: FontFamily.medium, fontSize: FontSize.base, color: Colors.black, marginRight: Spacing.sm },
  input: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.base, color: Colors.black },
  hint: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.grey400 },
  errorText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.danger },
})
