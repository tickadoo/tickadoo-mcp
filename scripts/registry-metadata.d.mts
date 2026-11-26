export const publisherMetadataKey: string;

export type RegistryToolMetadata = {
  name: string;
  annotations: Record<string, boolean>;
};

export function compactToolMetadata(tool: {
  name: string;
  annotations?: Record<string, unknown>;
  [key: string]: unknown;
}): RegistryToolMetadata;

export function assertPublisherMetadataSize(serverJson: unknown): void;
