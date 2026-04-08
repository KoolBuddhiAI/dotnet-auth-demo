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
