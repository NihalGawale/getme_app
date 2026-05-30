import { StyleSheet } from 'react-native'

export const FontFamily = {
  regular:     'DMSans_400Regular',
  medium:      'DMSans_500Medium',
  bold:        'DMSans_700Bold',
  displayBold: 'PlusJakartaSans_700Bold',
}

export const FontSize = {
  xs:   10,
  sm:   11,
  md:   13,
  base: 14,
  lg:   16,
  xl:   20,
  xxl:  22,
  h2:   24,
  h1:   28,
  display: 36,
}

export const LineHeight = {
  tight:  1.2,
  normal: 1.5,
  relaxed: 1.7,
}

// Reusable text styles
export const TextStyles = StyleSheet.create({
  h1: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h1,
    color: '#111111',
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h2,
    color: '#111111',
  },
  h3: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xl,
    color: '#111111',
  },
  title: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.lg,
    color: '#111111',
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: '#111111',
    lineHeight: FontSize.base * 1.6,
  },
  bodyMuted: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: '#6B6B68',
    lineHeight: FontSize.base * 1.6,
  },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#6B6B68',
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#6B6B68',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  logo: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.xl,
    color: '#111111',
    letterSpacing: -0.5,
  },
})
