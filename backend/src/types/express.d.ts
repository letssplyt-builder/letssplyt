import type { User } from '@supabase/supabase-js';
import type { EventRowWithReceiptFields } from '../modules/events/event.service';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: Pick<User, 'id' | 'email'> | null;
      /** Event row loaded by requireEventAccess middleware for the current request. */
      event?: EventRowWithReceiptFields;
    }
  }
}

export {};
