import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as profileService from '../../../services/profile.service';
import { useProfileStore } from '../../../store/profileStore';

jest.mock('../../../services/profile.service');

const mockUser = {
  id: 'user-1',
  display_name: 'Alex R.',
  avatar_colour: '#6366F1',
  avatar_url: null,
  total_events_created: 0,
  total_events_joined: 0,
  created_at: '2026-01-01T00:00:00.000Z',
};

const mockHandles = [
  {
    id: 'handle-1',
    provider: 'venmo' as const,
    handle_value: '@alex',
    display_order: 0,
  },
];

describe('profileStore', () => {
  beforeEach(() => {
    useProfileStore.setState({ user: null, handles: [], isLoading: false });
    jest.clearAllMocks();
  });

  it('loadProfile() calls both GET /users/me and GET /users/me/handles', async () => {
    jest.mocked(profileService.fetchMyProfile).mockResolvedValue(mockUser);
    jest.mocked(profileService.fetchMyHandles).mockResolvedValue(mockHandles);

    await useProfileStore.getState().loadProfile();

    expect(profileService.fetchMyProfile).toHaveBeenCalled();
    expect(profileService.fetchMyHandles).toHaveBeenCalled();
    expect(useProfileStore.getState().user).toEqual(mockUser);
    expect(useProfileStore.getState().handles).toEqual(mockHandles);
  });

  it('addHandle() adds the handle optimistically before the API response', async () => {
    let resolveCreate!: (value: {
      id: string;
      provider: 'venmo';
      display_order: number;
    }) => void;
    const createPromise = new Promise<{
      id: string;
      provider: 'venmo';
      display_order: number;
    }>((resolve) => {
      resolveCreate = resolve;
    });

    jest.mocked(profileService.addHandle).mockReturnValue(createPromise);

    const pending = useProfileStore.getState().addHandle('venmo', '@testhandle');
    expect(useProfileStore.getState().handles).toHaveLength(1);
    expect(useProfileStore.getState().handles[0]?.handle_value).toBe('@testhandle');
    expect(useProfileStore.getState().handles[0]?.id).toMatch(/^temp-/);

    resolveCreate({ id: 'real-handle-1', provider: 'venmo', display_order: 0 });
    await pending;

    expect(useProfileStore.getState().handles[0]?.id).toBe('real-handle-1');
  });

  it('addHandle() confirms the handle from the API response (updates with real ID)', async () => {
    jest
      .mocked(profileService.addHandle)
      .mockResolvedValue({ id: 'confirmed-id', provider: 'venmo', display_order: 1 });

    await useProfileStore.getState().addHandle('venmo', '@confirmed');

    expect(useProfileStore.getState().handles[0]).toEqual({
      id: 'confirmed-id',
      provider: 'venmo',
      handle_value: '@confirmed',
      display_order: 1,
    });
  });

  it('deleteHandle() removes the handle from the list immediately', async () => {
    useProfileStore.setState({ handles: mockHandles });
    jest.mocked(profileService.deleteHandle).mockResolvedValue();

    const pending = useProfileStore.getState().deleteHandle('handle-1');
    expect(useProfileStore.getState().handles).toEqual([]);
    await pending;
  });

  it('updateHandle() updates handle_value in the local list', async () => {
    useProfileStore.setState({ handles: mockHandles });
    jest.mocked(profileService.updateHandle).mockResolvedValue({
      id: 'handle-1',
      provider: 'venmo',
      handle_value: '@updated',
      display_order: 0,
    });

    await useProfileStore.getState().updateHandle('handle-1', '@updated');

    expect(useProfileStore.getState().handles[0]?.handle_value).toBe('@updated');
  });

  it('reorderHandles() updates display_order values in the local list', async () => {
    useProfileStore.setState({
      handles: [
        { id: 'a', provider: 'venmo', handle_value: '@a', display_order: 0 },
        { id: 'b', provider: 'paypal', handle_value: '@b', display_order: 1 },
      ],
    });
    jest.mocked(profileService.reorderHandles).mockResolvedValue();

    await useProfileStore.getState().reorderHandles(['b', 'a']);

    expect(useProfileStore.getState().handles.map((h) => h.id)).toEqual(['b', 'a']);
    expect(useProfileStore.getState().handles[0]?.display_order).toBe(0);
    expect(useProfileStore.getState().handles[1]?.display_order).toBe(1);
  });
});
