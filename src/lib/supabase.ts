import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface SupabaseErrorInfo {
  error: string;
  operationType: OperationType;
  table: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
  };
}

export function handleSupabaseError(error: unknown, operationType: OperationType, table: string | null) {
  let errorMessage = 'Unknown error';

  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'object' && error !== null) {
    // Handle Supabase error objects
    const supabaseError = error as any;
    if (supabaseError.message) {
      errorMessage = supabaseError.message;
      if (supabaseError.details) {
        errorMessage += ` - ${supabaseError.details}`;
      }
      if (supabaseError.hint) {
        errorMessage += ` (Hint: ${supabaseError.hint})`;
      }
    } else {
      errorMessage = JSON.stringify(error);
    }
  } else {
    errorMessage = String(error);
  }

  const errInfo: SupabaseErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: undefined,
      email: undefined,
      emailVerified: undefined,
      isAnonymous: false,
    },
    operationType,
    table
  };

  console.error('Supabase Error:', errInfo);
  console.error('Raw error:', error);
  throw new Error(errorMessage);
}
