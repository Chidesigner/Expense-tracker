import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ─── COUNTRY → CURRENCY MAP ───────────────────────────────────────────────────
export const COUNTRIES = [
  { code: 'NG', name: 'Nigeria',        currency: 'NGN', symbol: '₦',  flag: '🇳🇬' },
  { code: 'US', name: 'United States',  currency: 'USD', symbol: '$',  flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£',  flag: '🇬🇧' },
  { code: 'EU', name: 'Europe',         currency: 'EUR', symbol: '€',  flag: '🇪🇺' },
  { code: 'GH', name: 'Ghana',          currency: 'GHS', symbol: 'GH₵',flag: '🇬🇭' },
  { code: 'KE', name: 'Kenya',          currency: 'KES', symbol: 'KSh',flag: '🇰🇪' },
  { code: 'ZA', name: 'South Africa',   currency: 'ZAR', symbol: 'R',  flag: '🇿🇦' },
  { code: 'CA', name: 'Canada',         currency: 'CAD', symbol: 'CA$',flag: '🇨🇦' },
  { code: 'AU', name: 'Australia',      currency: 'AUD', symbol: 'A$', flag: '🇦🇺' },
  { code: 'IN', name: 'India',          currency: 'INR', symbol: '₹',  flag: '🇮🇳' },
  { code: 'AE', name: 'UAE',            currency: 'AED', symbol: 'د.إ',flag: '🇦🇪' },
  { code: 'SN', name: 'Senegal',        currency: 'XOF', symbol: 'CFA',flag: '🇸🇳' },
  { code: 'TZ', name: 'Tanzania',       currency: 'TZS', symbol: 'TSh',flag: '🇹🇿' },
  { code: 'RW', name: 'Rwanda',         currency: 'RWF', symbol: 'RF', flag: '🇷🇼' },
  { code: 'EG', name: 'Egypt',          currency: 'EGP', symbol: 'E£', flag: '🇪🇬' },
  { code: 'ET', name: 'Ethiopia',       currency: 'ETB', symbol: 'Br', flag: '🇪🇹' },
  { code: 'CM', name: 'Cameroon',       currency: 'XAF', symbol: 'CFA',flag: '🇨🇲' },
  { code: 'CI', name: "Côte d'Ivoire",  currency: 'XOF', symbol: 'CFA',flag: '🇨🇮' },
  { code: 'BR', name: 'Brazil',         currency: 'BRL', symbol: 'R$', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico',         currency: 'MXN', symbol: 'MX$',flag: '🇲🇽' },
  { code: 'PK', name: 'Pakistan',       currency: 'PKR', symbol: '₨',  flag: '🇵🇰' },
  { code: 'PH', name: 'Philippines',    currency: 'PHP', symbol: '₱',  flag: '🇵🇭' },
  { code: 'SG', name: 'Singapore',      currency: 'SGD', symbol: 'S$', flag: '🇸🇬' },
  { code: 'NG-D', name: 'Other',        currency: 'USD', symbol: '$',  flag: '🌍' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Nigeria

// ─── CONTEXT ──────────────────────────────────────────────────────────────────
const CurrencyContext = createContext({
  country: DEFAULT_COUNTRY,
  setCountry: () => {},
  fmt: (n) => `₦${n}`,
  symbol: '₦',
  loading: true,
});

export function CurrencyProvider({ children, user }) {
  const [country, setCountryState] = useState(DEFAULT_COUNTRY);
  const [loading, setLoading]      = useState(true);

  // Load user profile on mount / user change
  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const found = COUNTRIES.find(c => c.code === data.countryCode);
          if (found) setCountryState(found);
        }
      } catch (e) {
        console.error('Failed to load user profile', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  // Persist to Firestore + update local state
  const setCountry = async (countryObj) => {
    setCountryState(countryObj);
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        countryCode:  countryObj.code,
        country:      countryObj.name,
        currency:     countryObj.currency,
        symbol:       countryObj.symbol,
      }, { merge: true });
    } catch (e) {
      console.error('Failed to save country preference', e);
    }
  };

  // Format a number with the user's currency symbol
  const fmt = (n) => {
    const formatted = new Intl.NumberFormat('en', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n ?? 0);
    return `${country.symbol}${formatted}`;
  };

  return (
    <CurrencyContext.Provider value={{ country, setCountry, fmt, symbol: country.symbol, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}