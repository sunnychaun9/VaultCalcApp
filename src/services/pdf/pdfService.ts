/**
 * VaultCalc - PDF Service
 *
 * High-level API for PDF rendering operations.
 * Wraps the native PdfModule with error handling.
 *
 * @see FEATURE_INDEX.md DOC-003
 */

import { NativePdf, type PdfPageResult, type PdfThumbnailResult } from './nativePdf';

export type { PdfPageResult, PdfThumbnailResult } from './nativePdf';

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

/**
 * Get the number of pages in a PDF file.
 */
export async function getPageCount(filePath: string): Promise<ServiceResult<number>> {
  try {
    const count = await NativePdf.getPageCount(filePath);
    return { success: true, data: count };
  } catch (e) {
    return {
      success: false,
      error: { message: e instanceof Error ? e.message : String(e) },
    };
  }
}

/**
 * Render a single PDF page to a JPEG file.
 */
export async function renderPage(
  filePath: string,
  pageIndex: number,
  outputPath: string,
  renderWidth: number,
): Promise<ServiceResult<PdfPageResult>> {
  try {
    const result = await NativePdf.renderPage(filePath, pageIndex, outputPath, renderWidth);
    return { success: true, data: result };
  } catch (e) {
    return {
      success: false,
      error: { message: e instanceof Error ? e.message : String(e) },
    };
  }
}

/**
 * Generate a JPEG thumbnail from the first page of a PDF content URI (DOC-004).
 */
export async function generatePdfThumbnail(
  sourceUri: string,
  destPath: string,
  maxDimension?: number,
): Promise<ServiceResult<PdfThumbnailResult>> {
  try {
    const result = await NativePdf.generatePdfThumbnail(sourceUri, destPath, maxDimension ?? 256);
    return { success: true, data: result };
  } catch (e) {
    return {
      success: false,
      error: { message: e instanceof Error ? e.message : String(e) },
    };
  }
}
