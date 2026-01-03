const API_BASE_URL = process.env.API_BASE_URL!;

export interface FetchFromApiOptions extends RequestInit {
  body?: any;
}

export const fetchFromApi = async (
  endpoint: string,
  options: FetchFromApiOptions = {}
) => {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  let body = options.body;
  if (body && typeof body === "object" && !(body instanceof FormData)) {
    body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...options, headers, body });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw { status: res.status, details: data };
  }

  return data;
};
