import { QueryClient, QueryFunction } from "@tanstack/react-query";

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: any;

  constructor(message: string, status: number, code?: string, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

function extractErrorMessage(res: Response, text: string): string {
  const contentType = res.headers.get("content-type");
  
  if (contentType?.includes("application/json")) {
    try {
      const json = JSON.parse(text);
      
      if (json.error && typeof json.error === "string") {
        return json.error;
      }
      
      if (json.message && typeof json.message === "string") {
        return json.message;
      }
      
      if (json.detail && typeof json.detail === "string") {
        return json.detail;
      }
      
      if (Array.isArray(json.errors) && json.errors.length > 0) {
        const firstError = json.errors[0];
        if (typeof firstError === "string") {
          return firstError;
        }
        if (firstError.message) {
          return firstError.message;
        }
      }
    } catch (parseError) {
      // Not valid JSON, continue to fallback
    }
  }
  
  if (text && text.length > 0 && text.length < 500 && !text.startsWith("<")) {
    return text.trim();
  }
  
  return res.statusText || "Request failed";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    const message = extractErrorMessage(res, text);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    
    throw new ApiError(message, res.status, undefined, data);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const pathSegments: string[] = [];
    const allQueryParams: Record<string, any> = {};
    
    for (const segment of queryKey) {
      if (typeof segment === 'string' || typeof segment === 'number') {
        pathSegments.push(String(segment));
      } else if (segment && typeof segment === 'object' && !Array.isArray(segment)) {
        if (segment instanceof URLSearchParams) {
          segment.forEach((value, key) => {
            allQueryParams[key] = value;
          });
        } else {
          Object.assign(allQueryParams, segment);
        }
      } else if (Array.isArray(segment)) {
        throw new Error(`Query key contains unsupported array segment: ${JSON.stringify(segment)}`);
      }
    }
    
    let url = pathSegments.join("/");
    
    if (Object.keys(allQueryParams).length > 0) {
      const params = new URLSearchParams();
      Object.entries(allQueryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, String(v)));
          } else if (typeof value === 'boolean') {
            params.append(key, value ? 'true' : 'false');
          } else if (typeof value === 'object') {
            params.append(key, JSON.stringify(value));
          } else {
            params.append(key, String(value));
          }
        }
      });
      
      const queryString = params.toString();
      if (queryString) {
        url = `${url}?${queryString}`;
      }
    }
    
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
