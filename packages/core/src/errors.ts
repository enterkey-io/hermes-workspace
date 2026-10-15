export type ErrorCode =
  | 'STALE_REVISION'
  | 'HANDLE_TAKEN'
  | 'INVALID_REPORTING'
  | 'MODEL_UNAVAILABLE'
  | 'REQUIRES_SETUP'
  | 'INVALID_PHOTO'
  | 'INVALID_PARAMETERS'
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
  STALE_REVISION: 'Your workspace changed. Refresh it before saving again.',
  HANDLE_TAKEN: 'That handle already belongs to another agent. Choose a different handle.',
  INVALID_REPORTING:
    'Every agent must report to the orchestrator without a cycle. Move team members before deleting their team.',
  MODEL_UNAVAILABLE:
    'The selected model authorization changed or needs setup in Hermes. Review it before creating this agent.',
  REQUIRES_SETUP: 'This service needs its native Hermes installation before it can be added here.',
  INVALID_PHOTO: 'That photo could not be safely opened. Choose a PNG, JPEG or WebP image.',
  INVALID_PARAMETERS:
    'These settings could not be saved. Check the fields and refresh before trying again.',
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
