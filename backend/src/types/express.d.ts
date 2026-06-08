import type { User } from '@supabase/supabase-js';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: Pick<User, 'id' | 'email'> | null;
    }
  }
}

export {};
