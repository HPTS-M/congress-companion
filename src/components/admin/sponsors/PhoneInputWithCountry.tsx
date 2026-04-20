import { useMemo } from 'react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface CountryDialCode {
  code: string;        // e.g. "57"
  iso: string;         // e.g. "CO"
  name: string;        // e.g. "Colombia"
  flag: string;        // e.g. "🇨🇴"
}

// Curated list of ~25 common countries (LatAm, Europe, US/CA)
export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { code: '57',  iso: 'CO', name: 'Colombia',          flag: '🇨🇴' },
  { code: '52',  iso: 'MX', name: 'México',            flag: '🇲🇽' },
  { code: '1',   iso: 'US', name: 'Estados Unidos',    flag: '🇺🇸' },
  { code: '34',  iso: 'ES', name: 'España',            flag: '🇪🇸' },
  { code: '54',  iso: 'AR', name: 'Argentina',         flag: '🇦🇷' },
  { code: '56',  iso: 'CL', name: 'Chile',             flag: '🇨🇱' },
  { code: '51',  iso: 'PE', name: 'Perú',              flag: '🇵🇪' },
  { code: '593', iso: 'EC', name: 'Ecuador',           flag: '🇪🇨' },
  { code: '58',  iso: 'VE', name: 'Venezuela',         flag: '🇻🇪' },
  { code: '55',  iso: 'BR', name: 'Brasil',            flag: '🇧🇷' },
  { code: '591', iso: 'BO', name: 'Bolivia',           flag: '🇧🇴' },
  { code: '595', iso: 'PY', name: 'Paraguay',          flag: '🇵🇾' },
  { code: '598', iso: 'UY', name: 'Uruguay',           flag: '🇺🇾' },
  { code: '506', iso: 'CR', name: 'Costa Rica',        flag: '🇨🇷' },
  { code: '507', iso: 'PA', name: 'Panamá',            flag: '🇵🇦' },
  { code: '503', iso: 'SV', name: 'El Salvador',       flag: '🇸🇻' },
  { code: '502', iso: 'GT', name: 'Guatemala',         flag: '🇬🇹' },
  { code: '504', iso: 'HN', name: 'Honduras',          flag: '🇭🇳' },
  { code: '505', iso: 'NI', name: 'Nicaragua',         flag: '🇳🇮' },
  { code: '809', iso: 'DO', name: 'Rep. Dominicana',   flag: '🇩🇴' },
  { code: '53',  iso: 'CU', name: 'Cuba',              flag: '🇨🇺' },
  { code: '44',  iso: 'GB', name: 'Reino Unido',       flag: '🇬🇧' },
  { code: '33',  iso: 'FR', name: 'Francia',           flag: '🇫🇷' },
  { code: '49',  iso: 'DE', name: 'Alemania',          flag: '🇩🇪' },
  { code: '39',  iso: 'IT', name: 'Italia',            flag: '🇮🇹' },
  { code: '351', iso: 'PT', name: 'Portugal',          flag: '🇵🇹' },
];

const DEFAULT_DIAL = '57';

/**
 * Parse stored "+E.164" value into { dialCode, number }. If the prefix doesn't
 * match any known country, falls back to default and treats the rest as number.
 */
export function parsePhoneE164(stored: string | null | undefined): { dialCode: string; number: string } {
  if (!stored) return { dialCode: DEFAULT_DIAL, number: '' };
  const cleaned = stored.replace(/[^\d+]/g, '');
  const digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  if (!digits) return { dialCode: DEFAULT_DIAL, number: '' };

  // Try longest match first (3, 2, 1 digits)
  const sortedByLen = [...COUNTRY_DIAL_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sortedByLen) {
    if (digits.startsWith(c.code)) {
      return { dialCode: c.code, number: digits.slice(c.code.length) };
    }
  }
  return { dialCode: DEFAULT_DIAL, number: digits };
}

/**
 * Build the canonical "+<dialCode><number>" string. Returns empty string when
 * the local number is empty (so we don't store a bare prefix).
 */
export function buildPhoneE164(dialCode: string, number: string): string {
  const digits = number.replace(/\D/g, '');
  if (!digits) return '';
  return `+${dialCode}${digits}`;
}

interface Props {
  dialCode: string;
  number: string;
  onDialCodeChange: (code: string) => void;
  onNumberChange: (value: string) => void;
  numberPlaceholder?: string;
  invalid?: boolean;
  className?: string;
}

export function PhoneInputWithCountry({
  dialCode, number, onDialCodeChange, onNumberChange,
  numberPlaceholder, invalid, className,
}: Props) {
  const selected = useMemo(
    () => COUNTRY_DIAL_CODES.find((c) => c.code === dialCode) ?? COUNTRY_DIAL_CODES[0],
    [dialCode]
  );

  return (
    <div className={cn('flex gap-2', className)}>
      <Select value={dialCode} onValueChange={onDialCodeChange}>
        <SelectTrigger className="w-[130px] shrink-0">
          <SelectValue>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-base leading-none">{selected.flag}</span>
              <span className="text-sm">+{selected.code}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {COUNTRY_DIAL_CODES.map((c) => (
            <SelectItem key={c.iso} value={c.code}>
              <span className="inline-flex items-center gap-2">
                <span className="text-base leading-none">{c.flag}</span>
                <span className="text-sm">+{c.code}</span>
                <span className="text-xs text-muted-foreground truncate">{c.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={number}
        onChange={(e) => {
          // Only digits, max 14
          const digits = e.target.value.replace(/\D/g, '').slice(0, 14);
          onNumberChange(digits);
        }}
        placeholder={numberPlaceholder ?? '3001234567'}
        inputMode="tel"
        className={cn('flex-1', invalid && 'border-destructive')}
      />
    </div>
  );
}
