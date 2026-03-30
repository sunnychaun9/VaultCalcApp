/**
 * VaultCalc - Shared Formatters
 *
 * Common formatting utilities for file sizes, dates, and durations.
 */

/** Format bytes to human-readable size (e.g. "1.2 MB") */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Format timestamp to short date string (MM/DD/YYYY) */
export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

/** Format timestamp to date+time string (MM.DD.YYYY HH:MM) */
export function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${month}.${day}.${year} ${hours}:${minutes}`;
}

/** Format milliseconds to duration string (e.g. "1:23" or "1:02:30") */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Strip control characters (C0/C1) from user input, keeping normal whitespace.
 * Use before persisting user-provided names/titles.
 */
export function sanitizeUserInput(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

/** Format MIME type to human-readable label (e.g. "JPEG Image") */
export function formatMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'JPEG Image',
    'image/png': 'PNG Image',
    'image/gif': 'GIF Image',
    'image/webp': 'WebP Image',
    'image/heif': 'HEIF Image',
    'image/heic': 'HEIC Image',
    'video/mp4': 'MP4 Video',
    'video/quicktime': 'QuickTime Video',
    'video/x-matroska': 'MKV Video',
    'video/webm': 'WebM Video',
    'video/3gpp': '3GP Video',
    'application/pdf': 'PDF Document',
    'text/plain': 'Text File',
    'text/csv': 'CSV Spreadsheet',
    'application/json': 'JSON File',
    'application/zip': 'ZIP Archive',
  };

  if (map[mimeType]) return map[mimeType];

  // Fallback: capitalize sub-type
  const parts = mimeType.split('/');
  if (parts.length === 2) {
    const subType = parts[1].replace(/^x-/, '').replace(/^vnd\./, '').toUpperCase();
    const category = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return `${subType} ${category}`;
  }
  return mimeType;
}
