export interface ServerConfig {
  twitter?: {
    language?: string;
  };
  bluesky?: {};
  useMarkdownLinksAsShortener?: boolean;
}

export interface ConfigRepository {
  getServerConfig(serverId: string): ServerConfig;
}
