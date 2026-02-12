/**
 * VaultCalc - Native PDF Module Interface
 *
 * TypeScript interface for the native PdfModule.
 * Provides type-safe access to PDF rendering operations.
 *
 * @see FEATURE_INDEX.md DOC-003
 */

import { NativeModules, Platform } from 'react-native';

/**
 * Result of rendering a single PDF page
 */
export interface PdfPageResult {
  width: number;
  height: number;
  path: string;
}

/**
 * Result of generating a PDF thumbnail (DOC-004)
 */
export interface PdfThumbnailResult {
  width: number;
  height: number;
  thumbnailPath: string;
}

/**
 * Native PdfModule interface
 */
interface PdfModuleInterface {
  /**
   * Get the number of pages in a PDF file.
   * @param filePath Absolute path to the PDF file
   * @returns Page count
   */
  getPageCount(filePath: string): Promise<number>;

  /**
   * Render a single PDF page to a JPEG file.
   * @param filePath Absolute path to the PDF file
   * @param pageIndex Zero-based page index
   * @param outputPath Absolute path for the output JPEG
   * @param renderWidth Desired width in pixels
   * @returns Rendered page dimensions and path
   */
  renderPage(
    filePath: string,
    pageIndex: number,
    outputPath: string,
    renderWidth: number,
  ): Promise<PdfPageResult>;

  /**
   * Generate a JPEG thumbnail from the first page of a PDF content URI (DOC-004).
   * @param sourceUri content:// URI of the PDF file
   * @param destPath Absolute path for the output thumbnail JPEG
   * @param maxDimension Maximum width or height in pixels
   * @returns Thumbnail dimensions and path
   */
  generatePdfThumbnail(
    sourceUri: string,
    destPath: string,
    maxDimension: number,
  ): Promise<PdfThumbnailResult>;
}

/**
 * Get the native PdfModule (lazy — resolved on first access)
 */
let cachedModule: PdfModuleInterface | null = null;

function getPdfModule(): PdfModuleInterface {
  if (cachedModule) {
    return cachedModule;
  }

  if (Platform.OS !== 'android') {
    throw new Error('PdfModule is only available on Android');
  }

  const { PdfModule } = NativeModules;

  if (!PdfModule) {
    throw new Error(
      'PdfModule is not available. Make sure the native module is properly linked.',
    );
  }

  cachedModule = PdfModule as PdfModuleInterface;
  return cachedModule;
}

/**
 * Native PDF module proxy — lazily resolves the native module on first method call.
 */
export const NativePdf: PdfModuleInterface = new Proxy(
  {} as PdfModuleInterface,
  {
    get(_target, prop: string) {
      const module = getPdfModule();
      return module[prop as keyof PdfModuleInterface];
    },
  },
);
