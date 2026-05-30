import { Dimensions } from 'react-native'

const { width, height } = Dimensions.get('window')

export const Layout = {
  screenWidth:  width,
  screenHeight: height,
  isSmallDevice: width < 375,

  // Common paddings
  screenPadding:    20,
  cardPadding:      14,
  sectionPadding:   16,

  // Component heights
  tabBarHeight:     64,
  headerHeight:     52,
  inputHeight:      48,
  buttonHeight:     52,
  avatarSm:         32,
  avatarMd:         40,
  avatarLg:         56,
  avatarXl:         80,
}
