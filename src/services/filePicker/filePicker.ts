/**
 * VaultCalc - File Picker Service
 *
 * Wraps @react-native-documents/picker to provide a clean API
 * for selecting files from the device via Android SAF.
 *
 * @see FEATURE_INDEX.md FILE-001
 */

import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import type { TabType } from '@features/vault/hooks/useMediaQuery';
import type { PickedFile, PickerOptions } from './types';

/** MIME filters for each vault tab */
const TAB_MIME_FILTERS: Record<TabType, string[]> = {
  images: [types.images],
  videos: [types.video],
  documents: [
    types.pdf,
    types.plainText,
    types.doc,
    types.docx,
    types.xls,
    types.xlsx,
    'text/csv',
    types.ppt,
    types.pptx,
    types.json,
    types.zip,
  ],
  audio: [
    types.audio,
  ],
  albums: [],
  notes: [],
};

/**
 * Open the system file picker with the given options.
 * Returns selected files, or an empty array if the user cancels.
 */
export async function pickFiles(options: PickerOptions): Promise<PickedFile[]> {
  try {
    const results = await pick({
      type: options.type,
      allowMultiSelection: options.allowMultiSelection ?? true,
    });

    return results.map((r) => ({
      uri: r.uri,
      name: r.name ?? 'unknown',
      mimeType: r.type ?? 'application/octet-stream',
      size: r.size ?? 0,
    }));
  } catch (err: unknown) {
    if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
      return [];
    }
    throw err;
  }
}

/**
 * Open the system file picker with MIME filters appropriate for the given tab.
 * Returns selected files, or an empty array if the user cancels.
 */
export async function pickFilesForTab(tab: TabType): Promise<PickedFile[]> {
  return pickFiles({
    type: TAB_MIME_FILTERS[tab],
    allowMultiSelection: true,
  });
}
