export type ErrorCode =
  | 'INVALID_ENDPOINT'
  | 'INVALID_CREDENTIAL'
  | 'DISCONNECTED'
  | 'REQUEST_FAILED'
  | 'UNAUTHORIZED'
  | 'REQUEST_TIMEOUT'
  | 'RESPONSE_TOO_LARGE'
  | 'INVALID_RESPONSE'
  | 'UNSUPPORTED'
  | 'RPC_FAILED';

const messages: Record<ErrorCode, string> = {
  INVALID_ENDPOINT:
    'Enter a trusted HTTPS endpoint without credentials, query parameters, or fragments.',
  INVALID_CREDENTIAL: 'A credential is required for this interface.',
  DISCONNECTED: 'This connection has been closed.',
  REQUEST_FAILED:
    'The request failed. Check network access, origin permissions, and server configuration.',
  UNAUTHORIZED: 'The server did not authorize this request.',
  REQUEST_TIMEOUT: 'The server did not respond in time.',
  RESPONSE_TOO_LARGE: 'The response exceeded the permitted size.',
  INVALID_RESPONSE: 'The server returned an unexpected response.',
  UNSUPPORTED: 'The required Hermes interface is not available through this connection.',
  RPC_FAILED: 'Hermes could not complete the requested operation.',
};

/** Remote messages, URLs and credentials never enter public errors. */
export class ClientError extends Error {
  constructor(readonly code: ErrorCode) {
    super(messages[code]);
    this.name = 'ClientError';
  }
}

export function safeError(error: unknown): ClientError {
  return error instanceof ClientError ? error : new ClientError('REQUEST_FAILED');
}
