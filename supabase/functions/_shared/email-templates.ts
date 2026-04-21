/**
 * Shared email template renderer for CONGRÉSSAPP transactional emails.
 *
 * - Table-based layout (Outlook 2016/2019 compatible)
 * - Centralized branding (gradient, colors, footer, copyright)
 * - Hidden preheader for inbox preview
 * - Optional event metadata strip (dates, venue)
 * - Helpers to render code blocks and step lists
 * - Auto-generated plain-text fallback for Resend
 */

const BRAND = {
  primary: '#1A56A0',
  accent: '#00B89F',
  textDark: '#0F172A',
  textBody: '#334155',
  textMuted: '#64748B',
  textFaint: '#94A3B8',
  bgPage: '#F1F5F9',
  bgCard: '#FFFFFF',
  bgSoft: '#F8FAFC',
  border: '#E2E8F0',
  appName: 'CONGRÉSSAPP',
  appOwner: 'Health Plus Travels',
};

export interface RenderEmailOptions {
  /** Hidden preview text shown in the inbox listing. */
  preheader: string;
  /** Big H1 inside the card (e.g., "Hola María, ¡bienvenida!"). */
  headline: string;
  /** Optional eyebrow text above the headline (e.g., "🎫 Tu acceso"). */
  eyebrow?: string;
  /** First paragraph(s) of body content (HTML allowed; values must be pre-escaped). */
  intro: string;
  /** Optional middle blocks rendered between intro and CTA (raw HTML). */
  body?: string;
  /** Primary CTA label and URL. */
  ctaLabel?: string;
  ctaUrl?: string;
  /** Optional secondary plain-text URL hint shown below the button. */
  ctaUrlHint?: boolean;
  /** Optional small note below the CTA (legal / disclaimer). */
  footerNote?: string;
  /** Event name for the footer strip and title bar. */
  eventName?: string;
  /** Optional event metadata strip (dates + venue). */
  eventDates?: string;
  eventVenue?: string;
  /** Language attribute on <html>. Defaults to 'es'. */
  lang?: string;
}

/** Escape a value for safe HTML interpolation. */
export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Render a centered, prominent access-code block. */
export function codeBlock(code: string, label: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
    <tr>
      <td align="center" style="background:${BRAND.bgSoft};border:2px dashed ${BRAND.primary};border-radius:8px;padding:20px;">
        <div style="color:${BRAND.textMuted};font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;font-family:Arial,sans-serif;">${escapeHtml(label)}</div>
        <div style="color:${BRAND.primary};font-size:28px;font-weight:700;letter-spacing:3px;font-family:'Courier New',monospace;">${escapeHtml(code)}</div>
      </td>
    </tr>
  </table>`;
}

/** Render a numbered step list (used in "Cómo entrar"). */
export function stepList(title: string, steps: string[]): string {
  const items = steps
    .map(
      (s, i) => `
      <tr>
        <td valign="top" style="padding:0 12px 12px 0;width:28px;">
          <div style="background:${BRAND.primary};color:#ffffff;width:24px;height:24px;border-radius:12px;text-align:center;line-height:24px;font-size:13px;font-weight:700;font-family:Arial,sans-serif;">${i + 1}</div>
        </td>
        <td valign="top" style="padding:0 0 12px;color:${BRAND.textBody};font-size:14px;line-height:1.5;font-family:Arial,sans-serif;">${s}</td>
      </tr>`,
    )
    .join('');
  return `
  <div style="margin:0 0 24px;">
    <p style="color:${BRAND.textDark};font-size:14px;font-weight:600;margin:0 0 12px;font-family:Arial,sans-serif;">${escapeHtml(title)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
  </div>`;
}

/** Render an info card row (label + value). */
export function infoCard(label: string, value: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
    <tr>
      <td style="background:${BRAND.bgSoft};border-radius:8px;padding:14px 16px;">
        <div style="color:${BRAND.textMuted};font-size:12px;margin:0 0 4px;font-family:Arial,sans-serif;">${escapeHtml(label)}</div>
        <div style="color:${BRAND.textDark};font-size:15px;font-weight:600;font-family:Arial,sans-serif;">${escapeHtml(value)}</div>
      </td>
    </tr>
  </table>`;
}

export function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${BRAND.border};margin:24px 0;" />`;
}

/** Build the optional event-metadata strip (dates + venue). */
function eventMetaStrip(opts: RenderEmailOptions): string {
  if (!opts.eventDates && !opts.eventVenue) return '';
  const parts: string[] = [];
  if (opts.eventDates) {
    parts.push(
      `<span style="color:${BRAND.textBody};font-size:13px;font-family:Arial,sans-serif;">📅 ${escapeHtml(opts.eventDates)}</span>`,
    );
  }
  if (opts.eventVenue) {
    parts.push(
      `<span style="color:${BRAND.textBody};font-size:13px;font-family:Arial,sans-serif;">📍 ${escapeHtml(opts.eventVenue)}</span>`,
    );
  }
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
    <tr>
      <td style="background:${BRAND.bgSoft};border-radius:8px;padding:12px 16px;">
        ${parts.join('<br/>')}
      </td>
    </tr>
  </table>`;
}

function ctaBlock(opts: RenderEmailOptions): string {
  if (!opts.ctaLabel || !opts.ctaUrl) return '';
  const hint = opts.ctaUrlHint
    ? `
    <p style="color:${BRAND.textMuted};font-size:12px;line-height:1.5;margin:12px 0 0;text-align:center;font-family:Arial,sans-serif;">
      Si el botón no funciona, copia y pega esta dirección:<br/>
      <span style="color:${BRAND.primary};word-break:break-all;">${escapeHtml(opts.ctaUrl)}</span>
    </p>`
    : '';
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
    <tr>
      <td align="center">
        <a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;background:linear-gradient(135deg,${BRAND.primary},${BRAND.accent});color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;font-family:Arial,sans-serif;">${escapeHtml(opts.ctaLabel)}</a>
        ${hint}
      </td>
    </tr>
  </table>`;
}

/**
 * Render a full HTML email with consistent CONGRÉSSAPP branding.
 */
export function renderEmail(opts: RenderEmailOptions): string {
  const lang = opts.lang ?? 'es';
  const year = new Date().getFullYear();
  const eyebrow = opts.eyebrow
    ? `<p style="margin:0 0 8px;color:${BRAND.accent};font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;font-family:Arial,sans-serif;">${escapeHtml(opts.eyebrow)}</p>`
    : '';
  const eventTag = opts.eventName
    ? `<p style="margin:6px 0 0;font-size:13px;opacity:0.92;font-family:Arial,sans-serif;">${escapeHtml(opts.eventName)}</p>`
    : `<p style="margin:6px 0 0;font-size:13px;opacity:0.92;font-family:Arial,sans-serif;">${BRAND.appOwner}</p>`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${escapeHtml(opts.eventName ?? BRAND.appName)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bgPage};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;font-size:1px;color:${BRAND.bgPage};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bgPage};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${BRAND.bgCard};border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.accent} 100%);padding:28px 32px;color:#ffffff;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;font-family:Arial,sans-serif;">${BRAND.appName}</h1>
              ${eventTag}
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${eyebrow}
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:${BRAND.textDark};line-height:1.3;font-family:Arial,sans-serif;">${escapeHtml(opts.headline)}</h2>
              <p style="margin:0 0 20px;color:${BRAND.textBody};font-size:15px;line-height:1.6;font-family:Arial,sans-serif;">${opts.intro}</p>
              ${eventMetaStrip(opts)}
              ${opts.body ?? ''}
              ${ctaBlock(opts)}
              ${opts.footerNote ? `<p style="margin:16px 0 0;color:${BRAND.textMuted};font-size:12px;line-height:1.5;text-align:center;font-family:Arial,sans-serif;">${escapeHtml(opts.footerNote)}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND.bgSoft};padding:18px 32px;text-align:center;color:${BRAND.textFaint};font-size:12px;font-family:Arial,sans-serif;border-top:1px solid ${BRAND.border};">
              © ${year} ${BRAND.appName} — ${BRAND.appOwner}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generate a plain-text fallback from the same options.
 * Used as the `text:` field in Resend so non-HTML clients still get content.
 */
export function renderEmailText(opts: RenderEmailOptions & { steps?: string[]; codeLabel?: string; code?: string }): string {
  const lines: string[] = [];
  if (opts.eyebrow) lines.push(stripHtml(opts.eyebrow));
  lines.push(stripHtml(opts.headline));
  lines.push('');
  lines.push(stripHtml(opts.intro));
  if (opts.eventDates) lines.push(`Fecha: ${opts.eventDates}`);
  if (opts.eventVenue) lines.push(`Sede: ${opts.eventVenue}`);
  if (opts.code) {
    lines.push('');
    lines.push(`${opts.codeLabel ?? 'Código'}: ${opts.code}`);
  }
  if (opts.steps && opts.steps.length > 0) {
    lines.push('');
    opts.steps.forEach((s, i) => lines.push(`${i + 1}. ${stripHtml(s)}`));
  }
  if (opts.ctaLabel && opts.ctaUrl) {
    lines.push('');
    lines.push(`${opts.ctaLabel}: ${opts.ctaUrl}`);
  }
  if (opts.footerNote) {
    lines.push('');
    lines.push(stripHtml(opts.footerNote));
  }
  lines.push('');
  lines.push(`— ${BRAND.appName} · ${BRAND.appOwner}`);
  return lines.join('\n');
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** Format event dates as "del 15 al 17 de mayo de 2026" (es) or single date. */
export function formatEventDateRange(startISO?: string | null, endISO?: string | null, lang = 'es'): string {
  if (!startISO) return '';
  try {
    const start = new Date(startISO);
    const end = endISO ? new Date(endISO) : null;
    const locale = lang === 'en' ? 'en-US' : 'es-ES';
    const sameDay = end && start.toDateString() === end.toDateString();
    const fmt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    if (!end || sameDay) {
      return start.toLocaleDateString(locale, fmt);
    }
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth && lang === 'es') {
      const month = start.toLocaleDateString(locale, { month: 'long' });
      return `del ${start.getDate()} al ${end.getDate()} de ${month} de ${end.getFullYear()}`;
    }
    return `${start.toLocaleDateString(locale, fmt)} – ${end.toLocaleDateString(locale, fmt)}`;
  } catch {
    return '';
  }
}
