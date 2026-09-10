/**
 * A request that arrived on a mock's URL and was recorded by the server.
 *
 * `body` is text when the payload decoded as UTF-8 and base64 when it did not, which
 * `bodyEncoding` says; a binary payload survives instead of being mangled.
 *
 * `bodySize` is how many bytes the server read, which is itself capped: anything larger than the
 * read limit reports the limit rather than its true size, with `truncated` set.
 */
export interface CapturedRequest {
  id: string;
  method: string;
  path: string;
  query?: string;
  headers: Record<string, string>;
  contentType?: string;
  body?: string;
  bodyEncoding?: 'utf-8' | 'base64';
  bodySize: number;
  truncated: boolean;
  receivedAt: string;
}

export interface CapturedPage {
  items: CapturedRequest[];
  total: number;
  page: number;
  perPage: number;
  /** What the server keeps for this mock; 0 means capture is off. Authoritative over local state. */
  captureLimit: number;
}

/** Shape the API actually returns, in snake_case. */
export interface CapturedRequestAPI {
  id: string;
  method: string;
  path: string;
  query: string | null;
  headers: Record<string, string>;
  content_type: string | null;
  body: string | null;
  body_encoding: 'utf-8' | 'base64' | null;
  body_size: number;
  truncated: boolean;
  received_at: string;
}

export interface CapturedPageAPI {
  items: CapturedRequestAPI[];
  total: number;
  page: number;
  per_page: number;
  capture_limit?: number;
}
