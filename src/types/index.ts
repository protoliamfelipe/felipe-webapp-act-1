export interface User {
  id: string;
  email: string;
  name: string;
  role: 'freelancer' | 'client';
  company?: string;
  createdAt: string;
}

export interface FileRecord {
  id: string;
  userId: string;
  originalName: string;
  storedFileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  project: string;
  clientName?: string;
  note?: string;
  downloadsCount: number;
}

export interface FilesResponse {
  files: FileRecord[];
  totalCount: number;
  totalBytes: number;
  availableProjects: string[];
}

export interface UserStats {
  totalFiles: number;
  totalBytes: number;
  totalProjects: number;
  totalDownloads: number;
}
