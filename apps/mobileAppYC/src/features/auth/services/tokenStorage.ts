import * as Keychain from 'react-native-keychain';

const KEYCHAIN_SERVICE = 'yosemite-crew-session';
const KEYCHAIN_SERVICE_LEGACY = 'yosemite-crew-auth-tokens';
const KEYCHAIN_ACCOUNT = 'yosemite-crew';

export type AuthProviderName = 'amplify' | 'firebase';

export type StoredAuthTokens = {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  userId?: string;
  provider?: AuthProviderName;
};

type KeychainOptions = Parameters<typeof Keychain.setGenericPassword>[2];

const keychainOptions: KeychainOptions = {
  service: KEYCHAIN_SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  securityLevel: Keychain.SECURITY_LEVEL.SECURE_SOFTWARE,
};

export const storeTokens = async (tokens: StoredAuthTokens): Promise<void> => {
  try {
    const tokensWithProvider: StoredAuthTokens = {
      ...tokens,
      provider: tokens.provider ?? 'amplify',
    };
    const payload = JSON.stringify(tokensWithProvider);
    const didStore = await Keychain.setGenericPassword(
      KEYCHAIN_ACCOUNT,
      payload,
      keychainOptions,
    );

    if (!didStore) {
      throw new Error('Unable to persist auth tokens to secure storage');
    }
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Unexpected error while storing auth tokens securely',
    );
  }
};

const parsedTokensOrNull = (password: string): StoredAuthTokens | null => {
  try {
    const parsed = JSON.parse(password) as StoredAuthTokens;
    parsed.provider = parsed.provider ?? 'amplify';
    return parsed;
  } catch (parseError) {
    console.warn('Failed to parse tokens from secure storage', parseError);
    return null;
  }
};

export const loadStoredTokens = async (): Promise<StoredAuthTokens | null> => {
  try {
    const credentials = await Keychain.getGenericPassword(keychainOptions);
    if (credentials) {
      return parsedTokensOrNull(credentials.password);
    }

    // Migrate tokens stored under the previous service name
    const legacy = await Keychain.getGenericPassword({
      service: KEYCHAIN_SERVICE_LEGACY,
    });
    if (!legacy) {
      return null;
    }
    const tokens = parsedTokensOrNull(legacy.password);
    if (tokens) {
      await storeTokens(tokens);
      await Keychain.resetGenericPassword({service: KEYCHAIN_SERVICE_LEGACY});
    }
    return tokens;
  } catch (error) {
    console.error('Unable to read tokens from secure storage', error);
    return null;
  }
};

export const clearStoredTokens = async (): Promise<void> => {
  try {
    await Keychain.resetGenericPassword(keychainOptions);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Unexpected error while clearing secure auth tokens',
    );
  }
};
