/** API request/response shapes — shared between mobile and backend */

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ListResponse<T> {
  data: T[];
  count: number;
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}
