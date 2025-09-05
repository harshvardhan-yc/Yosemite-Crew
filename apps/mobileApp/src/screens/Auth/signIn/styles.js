import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {fonts} from '../../../utils/fonts';
import {colors} from '../../../../assets/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paletteWhite,
  },
  image: {
    width: '100%',
    height: scaledValue(285),
    marginTop: scaledValue(12),
  },
  gTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: scaledValue(32),
  },
  gTextRed: {
    fontSize: scaledValue(26),
    lineHeight: scaledHeightValue(26 * 1.2),
    letterSpacing: scaledValue(26 * -0.01),
  },
  gTextPurple: {
    fontSize: scaledValue(26),
    lineHeight: scaledHeightValue(26 * 1.2),
    letterSpacing: scaledValue(26 * -0.01),
    color: colors.jetBlack300,
    left: scaledValue(5),
  },
  inputContainer: {
    paddingHorizontal: scaledValue(20),
    marginTop: scaledValue(28),
  },
  input: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    // lineHeight: scaledValue(16),
    paddingLeft: scaledValue(10),
  },
  button: {
    backgroundColor: colors.jetBlack,
    width: '100%',
    height: scaledValue(56),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: scaledValue(20),
  },
  buttonText: {
    fontSize: scaledValue(18),
    letterSpacing: scaledValue(16 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    color: colors.paletteWhite,
  },
  notMemberContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: scaledValue(20),
  },
  notMemberText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16.8),
    letterSpacing: scaledValue(16 * -0.03),
    color: colors.jetBlack300,
    marginHorizontal: scaledValue(5),
  },
  signUpText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16.8),
    letterSpacing: scaledValue(16 * -0.03),
    color: colors.black,
    fontFamily: fonts?.SATOSHI_BOLD,
  },
  loginViaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(95),
    justifyContent: 'center',
  },
  divider: {
    borderWidth: scaledValue(0.5),
    width: scaledValue(80),
    border: colors.jetBlack,
  },
  loginViaText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.01),
    marginHorizontal: scaledValue(5),
    marginLeft: scaledValue(16),
    marginRight: scaledValue(16),

    opacity: 0.5,
  },
  socialButtonContainer: {
    flexDirection: 'row',
    // justifyContent: 'space-between',
    marginTop: scaledValue(24),
    marginBottom: scaledValue(25),
    gap: scaledValue(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconStyle: {
    width: scaledValue(24),
    height: scaledValue(24),
  },
  socialButton: {
    // height: scaledValue(48),
    alignSelf: 'center',
    borderRadius: scaledValue(28),
    paddingHorizontal: scaledValue(38),
    paddingVertical: scaledValue(12),
    alignItems: 'center',
    justifyContent: 'center',
    // paddingHorizontal: 45,
  },
  borderButton: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  socialButtonText: {
    fontSize: scaledValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
  },
  codeView: {
    // paddingHorizontal: scaledValue(28),
    width: scaledValue(50),
    height: scaledValue(56),
    justifyContent: 'center',
    borderBottomColor: 'black',
    backgroundColor: 'rgba(253, 189, 116, 0.12)',
    borderRadius: scaledValue(12),
    borderWidth: scaledValue(0.5),
    borderColor: 'rgba(55, 34, 60, 0.6)',
  },
  codeText: {
    color: '#354764',
    fontSize: scaledValue(30),
    textAlign: 'center',
    fontFamily: fonts.OPENSANS_SEMIBOLD,
    lineHeight: scaledHeightValue(40.85),
    letterSpacing: scaledValue(30 * 0.01),
  },
  rootStyle: {
    marginTop: scaledValue(20),
    justifyContent: 'space-evenly',
  },
});
