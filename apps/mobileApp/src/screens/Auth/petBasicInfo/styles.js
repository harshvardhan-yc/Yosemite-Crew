import {StyleSheet} from 'react-native';
import {scaledHeightValue, scaledValue} from '../../../utils/design.utils';
import {colors} from '../../../../assets/colors';

export const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: colors.themeColor,
    paddingHorizontal: scaledValue(20),
  },
  petImg: {
    width: scaledValue(100),
    height: scaledValue(100),
    borderRadius: scaledValue(50),
    borderWidth: scaledValue(1),
    borderColor: colors.primaryBlue,
    marginTop: scaledValue(20),
    alignSelf: 'center',
  },
  petName: {
    textAlign: 'center',
    marginTop: scaledValue(8),
    fontSize: scaledValue(23),
    letterSpacing: scaledValue(23 * -0.01),
  },
  breed: {
    textAlign: 'center',
    fontSize: scaledValue(14),
    marginTop: scaledValue(2),
    opacity: 0.7,
  },
  card: {
    borderWidth: scaledValue(1),
    borderColor: colors.jetBlack50,
    borderRadius: scaledValue(24),
    paddingHorizontal: scaledValue(20),
    paddingVertical: scaledValue(14),
    marginTop: scaledValue(15),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  petInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledValue(10),
  },
  petImageBorder: {
    overflow: 'hidden',
    borderRadius: scaledValue(32.5),
    alignItems: 'center',
    justifyContent: 'center',
    width: scaledValue(65),
    height: scaledValue(65),
    backgroundColor: colors.primaryBlue,
  },
  petImage: {
    width: scaledValue(64),
    height: scaledValue(64),
    borderRadius: scaledValue(32),
    resizeMode: 'cover',
  },
  petBreed: {
    fontSize: scaledValue(14),
    color: colors.jetBlack,
    opacity: 0.6,
  },
  qrCode: {
    width: scaledValue(60),
    height: scaledValue(60),
  },
  row: showDivider => ({
    paddingVertical: scaledValue(14),
    flexDirection: 'row',
    alignItems: 'center',
  }),
  label: {
    fontSize: scaledValue(15),
    color: colors.jetBlack300,
    width: scaledValue(150),
  },
  value: {
    fontSize: scaledValue(15),
    color: colors.jetBlack,
    textTransform: 'capitalize',
    maxWidth: '60%',
    textAlign: 'right',
  },
});
