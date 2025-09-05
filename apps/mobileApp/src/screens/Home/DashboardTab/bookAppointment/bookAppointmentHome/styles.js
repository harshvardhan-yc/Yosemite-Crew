import {StyleSheet} from 'react-native';
import {
  scaledHeightValue,
  scaledValue,
} from '../../../../../utils/design.utils';
import {fonts} from '../../../../../utils/fonts';
import {colors} from '../../../../../../assets/colors';

export const styles = StyleSheet.create({
  dashboardMainView: {
    flex: 1,
    backgroundColor: colors.themeColor,
  },
  searchTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.jetLightBlack,
  },
  searchIcon: {
    width: scaledValue(24),
    height: scaledValue(24),
  },
  searchBar: {
    height: scaledValue(48),
    borderWidth: scaledValue(0.75),
    borderRadius: scaledValue(28),
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: scaledValue(16),
    marginHorizontal: scaledValue(16),
    marginTop: scaledValue(16),
  },
  hospitalText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
  },
  optionContainer: {
    flexDirection: 'row',
    gap: scaledValue(4),
    paddingLeft: scaledValue(20),
  },
  optionButton: {
    height: scaledValue(35),
    borderRadius: scaledValue(24),
    justifyContent: 'center',
    paddingHorizontal: scaledValue(18),
    borderColor: colors.jetBlack,
  },
  optionText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    letterSpacing: scaledValue(16 * -0.01),
  },
  scrollView: {
    marginTop: scaledValue(12),
  },
  titleText: {
    fontSize: scaledValue(20),
    lineHeight: scaledValue(24),
    letterSpacing: scaledValue(20 * -0.01),
  },
  nearText: {
    fontSize: scaledValue(12),
    lineHeight: scaledValue(14.4),
    letterSpacing: scaledValue(12 * -0.02),

    opacity: 0.7,
  },
  imgStyle: {
    // width: scaledValue(200),
    width: '100%',
    height: scaledValue(133.33),
    borderRadius: scaledValue(12),
    borderWidth: scaledValue(0.2),
    borderColor: colors.inputPlaceholder,
    resizeMode: 'stretch',
  },
  nameText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    color: '#090A0A',
    marginTop: scaledValue(12),
  },
  timeText: {
    fontSize: scaledValue(12),
    lineHeight: scaledValue(14.4),

    marginTop: scaledValue(2),
    opacity: 0.7,
  },
  descriptionText: {
    fontSize: scaledValue(12),
    lineHeight: scaledValue(15.6),
    marginTop: scaledValue(6),
    opacity: 0.8,
  },
  locationImg: {
    width: scaledValue(16),
    height: scaledValue(16),
  },
  distanceText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(18),
    color: '#090A0A',
  },
  buttonTextStyle: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16),
    color: colors.jetBlack,
    marginLeft: scaledValue(2),
    letterSpacing: scaledValue(14 * -0.01),
    fontFamily: fonts.CLASH_GRO_MEDIUM,
  },
  buttonStyle: {
    borderWidth: scaledValue(1),
    borderColor: colors.jetBlack,
    borderRadius: scaledValue(28),
    height: scaledValue(38),
    // position: 'absolute',
    // bottom: 0,
    width: '92%',
    marginHorizontal: scaledValue(20),
    backgroundColor: 'transparent',
    gap: scaledValue(4),
    marginTop: scaledValue(15),
  },
  iconStyle: {
    width: scaledValue(14),
    height: scaledValue(14),
    color: colors.jetBlack,
  },
  innerView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(4),
  },
  textView: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: scaledValue(12),
    width: '100%',
  },
  flatListUnderView: {
    paddingHorizontal: scaledValue(20),
  },
  containerStyle: {
    gap: scaledValue(30),
  },
  flatListView: {
    marginTop: scaledValue(12),
  },
  titleView: {
    marginTop: scaledValue(20),
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
