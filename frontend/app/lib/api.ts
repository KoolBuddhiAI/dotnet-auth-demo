async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = `${res.status} ${res.statusText}`;
    try {
      const json = JSON.parse(text);
      message = json.error || json.message || message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

// === Quote types ===

export interface Quote {
  text: string;
  author: string;
  category: string;
  date?: string;
}

// === Developer types ===

export interface Developer {
  id: string;
  name: string;
  email: string;
  registeredAt: string;
  keys: ApiKeyInfo[];
}

export interface ApiKeyInfo {
  id: string;
  label: string;
  environment: string;
  clientId: string;
  clientSecret: string;
  createdAt: string;
  expiresAt: string | null;
  isActive: boolean;
  isExpired: boolean;
}

export interface ApiKeyDetail extends ApiKeyInfo {
  rateLimits: {
    requestsPerMinute: number;
    tokenTtlHours: number;
    maxKeys: number;
    expiresInDays: number | null;
  };
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// === Public Quotes (main app, no auth) ===

export async function getQuoteOfTheDay(): Promise<Quote> {
  return apiFetch("/api/quotes/today");
}

export async function getRandomQuote(): Promise<Quote> {
  return apiFetch("/api/quotes/random");
}

export async function getAllQuotes(category?: string): Promise<{ count: number; quotes: Quote[] }> {
  const params = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiFetch(`/api/quotes${params}`);
}

export async function getCategories(): Promise<string[]> {
  return apiFetch("/api/quotes/categories");
}

// === Developer self-service ===

export async function registerDeveloper(name: string, email: string): Promise<Developer & { message: string }> {
  return apiFetch("/api/developers/register", {
    method: "POST",
    body: JSON.stringify({ name, email }),
  });
}

export async function lookupDeveloper(email: string): Promise<Developer> {
  return apiFetch(`/api/developers/lookup?email=${encodeURIComponent(email)}`);
}

export async function getDeveloper(developerId: string): Promise<Developer> {
  return apiFetch(`/api/developers/${developerId}`);
}

export async function createApiKey(
  developerId: string,
  environment: string,
  label: string
): Promise<ApiKeyDetail & { message: string }> {
  return apiFetch(`/api/developers/${developerId}/keys`, {
    method: "POST",
    body: JSON.stringify({ environment, label }),
  });
}

export async function getApiKey(developerId: string, keyId: string): Promise<ApiKeyDetail> {
  return apiFetch(`/api/developers/${developerId}/keys/${keyId}`);
}

export async function rotateApiKey(
  developerId: string,
  keyId: string
): Promise<{ id: string; clientId: string; clientSecret: string; rotatedAt: string; message: string }> {
  return apiFetch(`/api/developers/${developerId}/keys/${keyId}/rotate`, { method: "POST" });
}

export async function deleteApiKey(
  developerId: string,
  keyId: string
): Promise<{ message: string }> {
  return apiFetch(`/api/developers/${developerId}/keys/${keyId}`, { method: "DELETE" });
}

// === Token exchange (for testing) ===

export async function getToken(clientId: string, clientSecret: string): Promise<TokenResponse> {
  const res = await fetch("/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = `${res.status}`;
    try {
      const json = JSON.parse(text);
      message = json.error_description || json.error || message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json();
}

export async function callProtectedQuotes(token: string): Promise<unknown> {
  return apiFetch("/api/v1/quotes/today", {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
}

// === Usage Analytics ===

export interface UsageSummary {
  developerId: string;
  period: { days: number; since: string };
  totalRequests: number;
  byKey: {
    keyId: string;
    clientId: string;
    environment: string;
    totalRequests: number;
    successCount: number;
    errorCount: number;
    avgResponseMs: number;
  }[];
  byEndpoint: { method: string; endpoint: string; count: number }[];
  byDay: { date: string; count: number }[];
}

export interface AdminUsage {
  period: { days: number; since: string };
  totalRequests: number;
  totalDevelopers: number;
  totalKeys: number;
  byDeveloper: {
    developerId: string;
    developerName: string;
    developerEmail: string;
    totalRequests: number;
    successCount: number;
    errorCount: number;
    avgResponseMs: number;
    keyCount: number;
  }[];
  byEnvironment: {
    environment: string;
    totalRequests: number;
    avgResponseMs: number;
    uniqueClients: number;
  }[];
  byEndpoint: { method: string; endpoint: string; count: number; avgResponseMs: number }[];
  byDay: { date: string; count: number; uniqueClients: number }[];
  todayByHour: { hour: number; count: number }[];
}

export interface RecentLogs {
  count: number;
  logs: {
    clientId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    environment: string;
    responseTimeMs: number;
    timestamp: string;
    developerId: string;
  }[];
}

export async function getDeveloperUsage(developerId: string, days = 7): Promise<UsageSummary> {
  return apiFetch(`/api/developers/${developerId}/usage?days=${days}`);
}

export async function getAdminUsage(adminKey: string, days = 7): Promise<AdminUsage> {
  return apiFetch(`/api/admin/usage?days=${days}`, {
    headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
  });
}

export async function getAdminRecentLogs(adminKey: string, count = 50): Promise<RecentLogs> {
  return apiFetch(`/api/admin/usage/recent?count=${count}`, {
    headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
  });
}
