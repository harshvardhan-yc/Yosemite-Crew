import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {fonts} from '../../../utils/fonts';
import {colors} from '../../../../assets/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.themeColor,
    paddingHorizontal: scaledValue(20),
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
  },
  backButtonImage: {
    width: scaledValue(28),
    height: scaledValue(28),
  },
  headerTextContainer: {
    flexDirection: 'row',
  },
  headerText: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
  },
  petProfileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(28),
    paddingHorizontal: scaledValue(20),
    justifyContent: 'center',
  },

  petName: {
    textAlign: 'center',
    marginTop: scaledValue(8),
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
  },
  breed: {
    textAlign: 'center',
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),

    marginTop: scaledValue(2),
    opacity: 0.7,
  },
  inputView: {
    marginTop: scaledValue(24),
    gap: scaledValue(16),
  },
  inputStyle: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    // lineHeight: scaledValue(16),
    marginTop: scaledValue(-6),
    paddingLeft: scaledValue(10),
  },
  arrowIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  cityView: {
    borderWidth: scaledValue(0.5),
    height: scaledValue(48),
    marginTop: scaledValue(20),
    borderRadius: scaledValue(24),
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: scaledValue(159.5),
  },
  textButton: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.appRed,
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    textAlign: 'center',
    marginTop: scaledValue(41),
  },

  cityMainView: {flexDirection: 'row', gap: scaledValue(16)},
  cityText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.03),
    opacity: 0.5,
  },
  modalContainer: {
    backgroundColor: colors.white,
    height: scaledValue(518.14),
    borderRadius: scaledValue(24),
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginTop: scaledValue(20),
    right: scaledValue(20),
  },
  closeIcon: {
    width: scaledValue(22),
    height: scaledValue(22),
  },
  noVetImage: {
    width: scaledValue(98.64),
    height: scaledValue(127.14),
    alignSelf: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scaledValue(24),
  },
  titleRedText: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.appRed,
  },
  titleBlackText: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: '#1C1C1E',
  },
  invitationText: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    textAlign: 'center',
    marginHorizontal: scaledValue(35),
  },
  sendInviteButton: {
    backgroundColor: colors.appRed,
    width: '85%',
    height: scaledValue(44),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: scaledValue(24),
    marginTop: scaledValue(12),
  },
  buttonIcon: {
    width: scaledValue(16),
    height: scaledValue(16),
  },
  sendInviteButtonText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    color: colors.white,
    marginLeft: scaledValue(6),
    top: scaledValue(2),
  },
  orContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaledValue(12),
  },
  lineSeparator: {
    width: scaledValue(32),
    borderWidth: scaledValue(0.5),
    borderColor: colors.darkPurple,
  },
  orText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.01),

    opacity: 0.5,
  },
  detailsContainer: {
    flexDirection: 'row',
    paddingHorizontal: scaledValue(34),
    marginTop: scaledValue(20),
  },
  checkIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  detailsText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    marginLeft: scaledValue(10),
  },
  inviteButton: {
    backgroundColor: 'transparent',
    width: '85%',
    height: scaledValue(44),
    borderRadius: scaledValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: scaledValue(48),
    marginTop: scaledValue(22),
    borderWidth: scaledValue(1),
    borderColor: colors.appRed,
    opacity: 0.5,
  },
  inviteButtonText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(16),
    letterSpacing: scaledValue(16 * -0.01),
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    color: colors.appRed,
    marginLeft: scaledValue(8),
    top: scaledValue(2),
  },
  petImageWrapper: {
    width: scaledValue(100),
    height: scaledValue(100),
    borderRadius: scaledValue(50),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBlue,
    marginTop: scaledValue(18),
    alignSelf: 'center',
  },
  // petImg: {
  //   width: scaledValue(95),
  //   height: scaledValue(95),
  //   borderRadius: scaledValue(47.5),
  // },
  input: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(14),
    paddingLeft: scaledValue(10),
  },
  sendText: {
    fontSize: scaledValue(23),
    letterSpacing: scaledValue(23 * -0.01),
  },
  iconStyle: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  buttonStyle: {
    gap: scaledValue(8),
  },
  petImg: {
    width: scaledValue(100),
    height: scaledValue(100),
    borderRadius: scaledValue(50),
    borderWidth: scaledValue(1),
    borderColor: colors.primaryBlue,
    alignSelf: 'center',
  },
  petName: {
    textAlign: 'center',
    marginTop: scaledValue(8),
    fontSize: scaledValue(23),
    lineHeight: scaledHeightValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
  },
  breed: {
    textAlign: 'center',
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),

    marginTop: scaledValue(2),
    opacity: 0.7,
  },
});
