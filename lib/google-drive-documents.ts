export const GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export type GoogleDriveDocumentType = 'docs' | 'sheets'

type GoogleDriveDocumentConfig = {
  mimeType: string
  editUrl: (fileId: string) => string
}

const googleDriveDocumentConfigs: Record<GoogleDriveDocumentType, GoogleDriveDocumentConfig> = {
  docs: {
    mimeType: 'application/vnd.google-apps.document',
    editUrl: (fileId) => `https://docs.google.com/document/d/${encodeURIComponent(fileId)}/edit`,
  },
  sheets: {
    mimeType: 'application/vnd.google-apps.spreadsheet',
    editUrl: (fileId) => `https://docs.google.com/spreadsheets/d/${encodeURIComponent(fileId)}/edit`,
  },
}

export function isGoogleDriveDocumentType(value: string): value is GoogleDriveDocumentType {
  return value === 'docs' || value === 'sheets'
}

export function googleDriveDocumentConfig(type: GoogleDriveDocumentType): GoogleDriveDocumentConfig {
  return googleDriveDocumentConfigs[type]
}
