import { User, FileRecord, FilesResponse, UserStats } from '../types';

const TOKEN_KEY = 'felivault_auth_token';
const USER_KEY = 'felivault_auth_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: HeadersInit = {
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  // If body is NOT FormData, set JSON content type
  if (!(options.body instanceof FormData) && !headers['Content-Type' as keyof HeadersInit]) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = 'An unexpected error occurred.';
    try {
      const errorData = await response.json();
      if (errorData.error) errorMsg = errorData.error;
    } catch {
      errorMsg = `Server responded with status ${response.status}`;
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Auth
  async register(data: { email: string; password: string; name: string; role?: 'freelancer' | 'client'; company?: string }): Promise<{ user: User; token: string; message: string }> {
    const res = await request<{ user: User; token: string; message: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setStoredToken(res.token);
    setStoredUser(res.user);
    return res;
  },

  async login(data: { email: string; password: string }): Promise<{ user: User; token: string; message: string }> {
    const res = await request<{ user: User; token: string; message: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setStoredToken(res.token);
    setStoredUser(res.user);
    return res;
  },

  async getCurrentUser(): Promise<{ user: User; stats: { fileCount: number; totalBytes: number } }> {
    const res = await request<{ user: User; stats: { fileCount: number; totalBytes: number } }>('/api/auth/me', {
      method: 'GET',
    });
    setStoredUser(res.user);
    return res;
  },

  logout(): void {
    clearStoredAuth();
  },

  // Files
  async getFiles(params?: { project?: string; search?: string; sortBy?: string }): Promise<FilesResponse> {
    const query = new URLSearchParams();
    if (params?.project) query.set('project', params.project);
    if (params?.search) query.set('search', params.search);
    if (params?.sortBy) query.set('sortBy', params.sortBy);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<FilesResponse>(`/api/files${qs}`, { method: 'GET' });
  },

  async uploadFiles(
    files: File[],
    metadata: { project?: string; clientName?: string; note?: string }
  ): Promise<{ message: string; files: FileRecord[] }> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    if (metadata.project) formData.append('project', metadata.project);
    if (metadata.clientName) formData.append('clientName', metadata.clientName);
    if (metadata.note) formData.append('note', metadata.note);

    return request<{ message: string; files: FileRecord[] }>('/api/files/upload', {
      method: 'POST',
      body: formData,
    });
  },

  async deleteFile(fileId: string): Promise<{ message: string; fileId: string }> {
    return request<{ message: string; fileId: string }>(`/api/files/${fileId}`, {
      method: 'DELETE',
    });
  },

  async updateFile(
    fileId: string,
    updates: { project?: string; clientName?: string; note?: string }
  ): Promise<{ message: string; file: FileRecord }> {
    return request<{ message: string; file: FileRecord }>(`/api/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async getStats(): Promise<UserStats> {
    return request<UserStats>('/api/stats', { method: 'GET' });
  },

  getFileDownloadUrl(fileId: string): string {
    return `/api/files/${fileId}/download`;
  },

  getFilePreviewUrl(fileId: string): string {
    return `/api/files/${fileId}/preview`;
  },
};
