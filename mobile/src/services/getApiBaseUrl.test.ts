import { describe, it, expect, beforeEach } from '@jest/globals';
import mockExpoConstants from '../__tests__/mocks/expo-constants';
import { getApiBaseUrl } from './getApiBaseUrl';

describe('getApiBaseUrl', () => {
  beforeEach(() => {
    mockExpoConstants.expoConfig = { extra: { apiUrl: 'http://localhost:3000' } };
    mockExpoConstants.expoGoConfig = { debuggerHost: '192.168.1.42:8081' };
  });

  it('uses LAN IP from Expo debugger host when apiUrl is localhost', () => {
    expect(getApiBaseUrl()).toBe('http://192.168.1.42:3000');
  });

  it('uses explicit EXPO_PUBLIC_API_URL when not localhost', () => {
    mockExpoConstants.expoConfig = { extra: { apiUrl: 'https://api.example.com' } };
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });
});
