export const REQUEST_ID_PROVIDER_PORT = Symbol('RequestIdProviderPort');

export interface RequestIdProviderPort {
  generate(): string;
}
