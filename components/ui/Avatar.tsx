import { View, Text, Image, StyleSheet } from 'react-native'
import { Colors } from '../../constants/Colors'
import { FontFamily } from '../../constants/Typography'
import { Layout } from '../../constants/Layout'

type AvatarProps = {
  name?: string | null
  uri?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZE_MAP = {
  sm: Layout.avatarSm,
  md: Layout.avatarMd,
  lg: Layout.avatarLg,
  xl: Layout.avatarXl,
}

const FONT_MAP = {
  sm: 11,
  md: 13,
  lg: 18,
  xl: 24,
}

export default function Avatar({ name, uri, size = 'md' }: AvatarProps) {
  const dimension = SIZE_MAP[size]
  const fontSize = FONT_MAP[size]

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const style = {
    width: dimension,
    height: dimension,
    borderRadius: dimension / 2,
  }

  if (uri) {
    return <Image source={{ uri }} style={[s.base, style]} />
  }

  return (
    <View style={[s.base, s.fallback, style]}>
      <Text style={[s.initials, { fontSize }]}>{initials}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  base: { overflow: 'hidden' },
  fallback: { backgroundColor: Colors.grey100, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: FontFamily.medium, color: Colors.grey700 },
})
