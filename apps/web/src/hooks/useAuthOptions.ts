import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_V1 } from '../config';

export type AuthOptions = {
  /** Sign-up asks for a 6-digit email code. */
  emailVerification: boolean;
  /** "Forgot password" works (the server can send email). */
  passwordReset: boolean;
};

let cached: AuthOptions | null = null;

/** What the sign-in pages should offer on this server. Null while loading. */
export function useAuthOptions(): AuthOptions | null {
  const [options, setOptions] = useState<AuthOptions | null>(cached);
  useEffect(() => {
    if (cached) return;
    axios.get(`${API_V1}/auth/options`, { withCredentials: true })
      .then((res) => {
        cached = { emailVerification: !!res.data.emailVerification, passwordReset: !!res.data.passwordReset };
        setOptions(cached);
      })
      // If it can't be loaded, keep the links visible; the server still decides.
      .catch(() => setOptions({ emailVerification: false, passwordReset: true }));
  }, []);
  return options;
}
