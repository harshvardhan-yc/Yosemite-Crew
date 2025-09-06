import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import React, {useEffect, useState} from 'react';
import {Images} from '../../../utils';
import GText from '../../../components/GText/GText';
import Input from '../../../components/Input';
import {useTranslation} from 'react-i18next';
import GButton from '../../../components/GButton';
import GTextButton from '../../../components/GTextButton/GTextButton';
import {styles} from './styles';
import {send_otp_sign_in} from '../../../redux/slices/authSlice';
import {useAppDispatch} from '../../../redux/store/storeUtils';

const SignIn = ({navigation}) => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState('');
  const [timerCount, setTimer] = useState();
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    if (timerCount > 0) {
      let interval = setInterval(() => {
        setTimer(lastTimerCount => {
          lastTimerCount <= 1 && clearInterval(interval);
          return lastTimerCount - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [timerCount]);

  const buttonList = [
    {
      id: 2,
      title: '',
      icon: Images.google,
      backgroundColor: '#FFFFFF',
      textColor: '#344054',
    },
    {
      id: 3,
      title: '',
      icon: Images.fb,
      backgroundColor: '#1877F2',
      textColor: '#FFFEFE',
    },
    {
      id: 4,
      title: '',
      icon: Images.apple,
      backgroundColor: '#000000',
      textColor: '#FFFEFE',
    },
  ];

  const send_otp_hit = () => {
    let input = {
      email: email,
    };

    dispatch(send_otp_sign_in(input)).then(res => {
      if (send_otp_sign_in.fulfilled.match(res)) {
        if (res?.payload?.status === 1) {
          navigation.navigate('VerifyOtp', {email: email});
        }
      }
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Image source={Images.Sign_in} style={styles.image} />
        <View style={styles.gTextContainer}>
          <GText
            GrMedium
            text={t('purr_fect_string')}
            style={styles.gTextRed}
          />
          <GText
            GrMedium
            text={t('to_have_you_back_string')}
            style={styles.gTextPurple}
          />
        </View>
        <View style={styles.inputContainer}>
          <Input
            value={email}
            label={t('email_address_string')}
            onChangeText={value => setEmail(value)}
            style={styles.input}
            keyboardType={'email-address'}
            autoCapitalize="none"
          />

          <GButton
            onPress={() => {
              send_otp_hit();
            }}
            title={t('send_otp_string')}
            style={styles.button}
            textStyle={styles.buttonText}
          />
          <View style={styles.notMemberContainer}>
            <GText
              SatoshiBold
              text={t('not_a_member_string')}
              style={styles.notMemberText}
            />
            <GTextButton
              onPress={() => navigation?.goBack()}
              title={t('sign_up_string')}
              titleStyle={styles.signUpText}
            />
          </View>
          {/* <View style={styles.loginViaContainer}>
            <View style={styles.divider} />
            <GText
              GrMedium
              text={t('login_via_string')}
              style={styles.loginViaText}
            />
            <View style={styles.divider} />
          </View> */}
          {/* <View style={styles.socialButtonContainer}>
            {buttonList?.map(item => (
              <GButton
                key={item?.id}
                onPress={() => {}}
                title={item?.title}
                icon={item?.icon}
                iconStyle={styles.iconStyle}
                style={[
                  styles.socialButton,
                  {backgroundColor: item?.backgroundColor},
                  item?.id === 2 && styles.borderButton,
                ]}
                textStyle={[styles.socialButtonText, {color: item?.textColor}]}
              />
            ))}
          </View> */}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SignIn;
