/** Result from picking a file */
export interface PickedFile {
  uri: string; // content:// URI (Android SAF)
  name: string; // Original filename
  mimeType: string; // e.g. "image/jpeg"
  size: number; // Bytes
}

/** Options for the file picker */
export interface PickerOptions {
  /** MIME type filters */
  type: string[];
  /** Allow selecting multiple files */
  allowMultiSelection?: boolean;
}
