import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';

export interface ParticipantNameRow {
  user_id: string | null;
  display_name: string;
}

export async function loadLinkedUserDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, display_name')
    .in('id', userIds);

  if (error) {
    throw new AppError(
      'PARTICIPANT_NAMES_FETCH_FAILED',
      'Could not load participant names',
      500,
    );
  }

  return new Map(
    (data ?? []).map((row) => [row.id as string, row.display_name as string]),
  );
}

export function resolveLinkedDisplayName(
  row: ParticipantNameRow,
  linkedNames: Map<string, string>,
): string {
  if (row.user_id) {
    const liveName = linkedNames.get(row.user_id);
    if (liveName) {
      return liveName;
    }
  }

  return row.display_name;
}

export function collectLinkedUserIds(
  rows: Array<{ user_id: string | null }>,
): string[] {
  return [...new Set(
    rows
      .map((row) => row.user_id)
      .filter((id): id is string => id != null),
  )];
}
