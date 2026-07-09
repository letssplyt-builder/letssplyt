import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Platform } from 'react-native';
import mockExpoConstants from '../__tests__/mocks/expo-constants';
import { getApiBaseUrl } from './getApiBaseUrl';

describe('getApiBaseUrl', () => {
  const originalOs = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'ios';
    mockExpoConstants.isDevice = true;
    mockExpoConstants.expoConfig = { extra: { apiUrl: 'http://localhost:3000' } };
    mockExpoConstants.expoGoConfig = { debuggerHost: '192.168.1.42:8081' };
  });

  afterEach(() => {
    Platform.OS = originalOs;
  });

  it('uses LAN IP from Expo debugger host when apiUrl is localhost (physical device)', () => {
    expect(getApiBaseUrl()).toBe('http://192.168.1.42:3000');
  });

  it('uses localhost on iOS Simulator even when debugger host is a LAN IP', () => {
    mockExpoConstants.isDevice = false;
    expect(getApiBaseUrl()).toBe('http://localhost:3000');
  });

  it('uses explicit EXPO_PUBLIC_API_URL when not localhost', () => {
    mockExpoConstants.expoConfig = { extra: { apiUrl: 'https://api.example.com' } };
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('strips a trailing /api/v1 from misconfigured EXPO_PUBLIC_API_URL', () => {
    mockExpoConstants.expoConfig = {
      extra: { apiUrl: 'https://staging.letssplyt.com/api/v1' },
    };
    expect(getApiBaseUrl()).toBe('https://staging.letssplyt.com');
  });
});
