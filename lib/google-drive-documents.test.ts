import { describe, expect, it } from 'vitest'
import {
  GOOGLE_DRIVE_FILE_SCOPE,
  googleDriveDocumentConfig,
  isGoogleDriveDocumentType,
} from './google-drive-documents'

describe('Google Drive document configuration', () => {
  it('uses the Drive file scope and persistent Google Docs URLs', () => {
    expect(GOOGLE_DRIVE_FILE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file')
    expect(googleDriveDocumentConfig('docs').mimeType).toBe('application/vnd.google-apps.document')
    expect(googleDriveDocumentConfig('docs').editUrl('file-id')).toBe(
      'https://docs.google.com/document/d/file-id/edit'
    )
  })

  it('uses the Google Sheets MIME type and rejects unrelated apps', () => {
    expect(googleDriveDocumentConfig('sheets').mimeType).toBe('application/vnd.google-apps.spreadsheet')
    expect(isGoogleDriveDocumentType('sheets')).toBe(true)
    expect(isGoogleDriveDocumentType('word')).toBe(false)
  })
})
