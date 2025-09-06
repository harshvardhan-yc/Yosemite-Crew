import {
  Dimensions,
  Image,
  ImageBackground,
  Platform,
  StatusBar,
  View,
} from 'react-native';
import React from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GText from '../../../components/GText/GText';
import {Images} from '../../../utils';
import GButton from '../../../components/GButton';
import {useTranslation} from 'react-i18next';
import {styles} from './styles';
import {colors} from '../../../../assets/colors';
import {useDispatch} from 'react-redux';
import {setOnBoarding} from '../../../redux/slices/authSlice';
import {scaledValue} from '../../../utils/design.utils';

const ForthSwipe = () => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const dispatch = useDispatch();
  const {t} = useTranslation();
  return (
    <View style={styles.onboardingMainContainer}>
      <StatusBar backgroundColor={'#FFF2E3'} barStyle="dark-content" />
      <View style={styles.onboardingTitleView(statusBarHeight)}>
        <GText
          Medium
          text={t('access_medical_records_string')}
          style={styles.onboardingTitleStyle}
        />
        <GText
          text={t('anytime_string')}
          style={styles.onboardingSecondTitleStyle(colors.lightPurple)}
        />
      </View>
      <Image source={Images.forth_indicator} style={styles.indicator} />
      {/* <Image source={Images.plus} style={styles.forthScreenFirstPlusImage} /> */}
      <GButton
        onPress={() => {
          dispatch(setOnBoarding(true));
        }}
        title={t('get_started_string')}
        style={[
          styles.getStartedBtn,
          {top: scaledValue(Platform.OS == 'android' ? 120 : 90)},
        ]}
        textStyle={styles.getStartedTextBtn}
      />
      <Image
        source={Images.ForthOnBoarding}
        style={{
          width: Dimensions.get('window').width, // take full width of screen
          height: Dimensions.get('window').width * 1.265,
          marginTop: 'auto',
        }}
      />
    </View>
  );
};

export default ForthSwipe;
