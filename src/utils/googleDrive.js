// Google Drive API Utility
// Fetches files from shared public Google Drive folders using API key (no OAuth)

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

// Extract folder ID from Google Drive URL
export function extractFolderId(url) {
  if (!url) return null;

  // Handle direct folder IDs
  if (/^[a-zA-Z0-9_-]+$/.test(url) && url.length > 10) {
    return url;
  }

  // Handle full URLs
  const patterns = [
    /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/drive\/u\/\d+\/folders\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/folderview\?.*id=([a-zA-Z0-9_-]+)/,
    /docs\.google\.com\/folder\/d\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Fetch files from a public Google Drive folder using API key
// Works for folders shared with "Anyone with the link" or "Public on the web"
export async function fetchDriveFolderFiles(folderId, apiKey) {
  if (!folderId) {
    throw new Error('Folder ID is required');
  }

  if (!apiKey) {
    throw new Error('Google API key is not configured. Add VITE_GOOGLE_API_KEY to your .env file and restart the server.');
  }

  const query = "'" + folderId + "' in parents and trashed = false";
  const fields = 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, thumbnailLink, iconLink)';
  let allFiles = [];
  let pageToken = null;

  do {
    let url = DRIVE_API_BASE + '/files?q=' + encodeURIComponent(query) + '&fields=nextPageToken, ' + fields + '&pageSize=100&orderBy=name' + (apiKey ? '&key=' + apiKey : '');
    if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);

    const res = await fetch(url);

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      const msg = error.error?.message || 'Drive API error: ' + res.status;
      if (res.status === 403 || res.status === 404) {
        throw new Error('Folder not found or not publicly shared. Make sure the folder is set to "Anyone with the link can view".');
      }
      throw new Error(msg);
    }

    const data = await res.json();
    allFiles = allFiles.concat(data.files || []);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allFiles;
}

// Get file type category from MIME type
export function getFileCategory(mimeType) {
  if (!mimeType) return 'other';

  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'document';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('folder')) return 'folder';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return 'archive';

  return 'other';
}

// Get file icon based on MIME type
export function getFileIcon(mimeType) {
  const category = getFileCategory(mimeType);
  const icons = {
    pdf: '\u{1F4C4}',
    image: '\u{1F5BC}\uFE0F',
    video: '\u{1F3AC}',
    spreadsheet: '\u{1F4CA}',
    document: '\u{1F4DD}',
    presentation: '\u{1F4FD}\uFE0F',
    folder: '\u{1F4C1}',
    archive: '\u{1F4E6}',
    other: '\u{1F4CE}',
  };
  return icons[category] || icons.other;
}

// Format file size
export function formatFileSize(bytes) {
  if (!bytes) return '\u2014';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

// Store/retrieve Drive folder config for batches
const DRIVE_CONFIG_KEY = 'aust-drive-folders';

export function getDriveFolderConfig() {
  try {
    const stored = localStorage.getItem(DRIVE_CONFIG_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveDriveFolderConfig(config) {
  try {
    localStorage.setItem(DRIVE_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save Drive config:', e);
  }
}

// Get folder URL for a specific course/batch
export function getCourseFolderUrl(course, department, yearSem) {
  const config = getDriveFolderConfig();
  const key = course + '-' + department + '-' + yearSem;
  return config[key] || null;
}

// Save folder URL for a specific course/batch
export function saveCourseFolderUrl(course, department, yearSem, folderUrl) {
  const config = getDriveFolderConfig();
  const key = course + '-' + department + '-' + yearSem;
  config[key] = folderUrl;
  saveDriveFolderConfig(config);
}

// Get folder URL for a semester (no course — shows all materials for the semester)
export function getSemesterFolderUrl(department, yearSem) {
  const config = getDriveFolderConfig();
  const key = '__sem__' + department + '-' + yearSem;
  return config[key] || null;
}

// Save folder URL for a semester (no course)
export function saveSemesterFolderUrl(department, yearSem, folderUrl) {
  const config = getDriveFolderConfig();
  const key = '__sem__' + department + '-' + yearSem;
  config[key] = folderUrl;
  saveDriveFolderConfig(config);
}
