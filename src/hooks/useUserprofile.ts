import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../firebase';

// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface UserProfile {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  photoURL?: string | null;
  provider?: string;
  countryCode?: string;
  country?: string;
  currency?: string;
  symbol?: string;
}

interface UseUserProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────
/**
 * useUserProfile — reactive Firestore listener on users/{uid}.
 * Automatically updates whenever the Firestore doc changes.
 */
export function useUserProfile(user: User | null): UseUserProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile({
            uid:   user.uid,
            email: user.email ?? '',
            ...snap.data(),
          } as UserProfile);
        } else {
          // Fallback — derive from Firebase Auth object
          setProfile({
            uid:         user.uid,
            email:       user.email ?? '',
            username:    user.email?.split('@')[0] ?? 'user',
            displayName: user.displayName ?? user.email?.split('@')[0] ?? 'User',
            photoURL:    user.photoURL ?? null,
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error('useUserProfile error:', err);
        setLoading(false);
      }
    );

    return unsub;
  }, [user]);

  return { profile, loading };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
/**
 * getInitials — returns up to 2 uppercase initials from a name string.
 * e.g. "John Doe" → "JD", "alice" → "AL", "" → "FT"
 */
export function getInitials(name: string = ''): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'FT';
}