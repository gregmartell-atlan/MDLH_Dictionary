/**
 * Fetch type declarations for Node.js environment
 * Node 18+ has native fetch support
 */

declare global {
  function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;

  interface RequestInit {
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit | null;
    mode?: RequestMode;
    credentials?: RequestCredentials;
    cache?: RequestCache;
    redirect?: RequestRedirect;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    integrity?: string;
    keepalive?: boolean;
    signal?: AbortSignal | null;
  }

  interface Response {
    readonly headers: Headers;
    readonly ok: boolean;
    readonly redirected: boolean;
    readonly status: number;
    readonly statusText: string;
    readonly type: ResponseType;
    readonly url: string;
    clone(): Response;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    formData(): Promise<FormData>;
    json(): Promise<unknown>;
    text(): Promise<string>;
  }

  interface Headers {
    append(name: string, value: string): void;
    delete(name: string): void;
    get(name: string): string | null;
    has(name: string): boolean;
    set(name: string, value: string): void;
    forEach(callbackfn: (value: string, key: string, parent: Headers) => void): void;
  }

  type HeadersInit = Headers | string[][] | Record<string, string>;
  type BodyInit = Blob | BufferSource | FormData | URLSearchParams | ReadableStream<Uint8Array> | string;
  type RequestInfo = Request | string;
  type RequestMode = 'cors' | 'navigate' | 'no-cors' | 'same-origin';
  type RequestCredentials = 'include' | 'omit' | 'same-origin';
  type RequestCache = 'default' | 'force-cache' | 'no-cache' | 'no-store' | 'only-if-cached' | 'reload';
  type RequestRedirect = 'error' | 'follow' | 'manual';
  type ReferrerPolicy = '' | 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';
  type ResponseType = 'basic' | 'cors' | 'default' | 'error' | 'opaque' | 'opaqueredirect';

  interface Blob {
    readonly size: number;
    readonly type: string;
    arrayBuffer(): Promise<ArrayBuffer>;
    slice(start?: number, end?: number, contentType?: string): Blob;
    stream(): ReadableStream<Uint8Array>;
    text(): Promise<string>;
  }

  interface FormData {
    append(name: string, value: string | Blob, fileName?: string): void;
    delete(name: string): void;
    get(name: string): FormDataEntryValue | null;
    getAll(name: string): FormDataEntryValue[];
    has(name: string): boolean;
    set(name: string, value: string | Blob, fileName?: string): void;
  }

  type FormDataEntryValue = File | string;

  interface File extends Blob {
    readonly lastModified: number;
    readonly name: string;
  }

  interface Request {
    readonly cache: RequestCache;
    readonly credentials: RequestCredentials;
    readonly destination: RequestDestination;
    readonly headers: Headers;
    readonly integrity: string;
    readonly method: string;
    readonly mode: RequestMode;
    readonly redirect: RequestRedirect;
    readonly referrer: string;
    readonly referrerPolicy: ReferrerPolicy;
    readonly url: string;
    clone(): Request;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    formData(): Promise<FormData>;
    json(): Promise<unknown>;
    text(): Promise<string>;
  }

  type RequestDestination = '' | 'audio' | 'audioworklet' | 'document' | 'embed' | 'font' | 'frame' | 'iframe' | 'image' | 'manifest' | 'object' | 'paintworklet' | 'report' | 'script' | 'sharedworker' | 'style' | 'track' | 'video' | 'worker' | 'xslt';
}

export {};
