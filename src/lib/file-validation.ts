/**
 * Centralized file validation utility.
 * Validates user-selected files for type, extension and size before upload.
 */

export const SPONSOR_LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const SPONSOR_LOGO_EXT = ['png', 'jpg', 'jpeg', 'webp'] as const;
export const SPONSOR_LOGO_MAX = 2 * 1024 * 1024; // 2 MB

export const SPONSOR_MATERIALS_MIME = ['application/pdf'] as const;
export const SPONSOR_MATERIALS_EXT = ['pdf'] as const;
export const SPONSOR_MATERIALS_MAX = 10 * 1024 * 1024; // 10 MB

export type FileValidationCode = 'empty' | 'invalid_type' | 'invalid_ext' | 'too_large';

export interface FileValidationResult {
  ok: boolean;
  code?: FileValidationCode;
}

export function validateFile(
  file: File,
  allowedMime: readonly string[],
  allowedExt: readonly string[],
  maxSize: number,
): FileValidationResult {
  if (!file || file.size === 0) {
    return { ok: false, code: 'empty' };
  }
  if (file.size > maxSize) {
    return { ok: false, code: 'too_large' };
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const extOk = allowedExt.includes(ext);
  // Some browsers/OS (e.g. Windows + Edge) may return file.type === '' for
  // valid files. Trust the extension when MIME is missing.
  if (file.type) {
    if (!allowedMime.includes(file.type)) {
      return { ok: false, code: 'invalid_type' };
    }
  } else if (!extOk) {
    return { ok: false, code: 'invalid_ext' };
  }
  if (!extOk) {
    return { ok: false, code: 'invalid_ext' };
  }
  return { ok: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
