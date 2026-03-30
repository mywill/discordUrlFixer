export interface ServerConfig {
  twitter?: {
    language?: string;
  };
  bluesky?: {};
  reddit?: {
    includeOldRedditLink?: boolean;
  };
  useMarkdownLinksAsShortener?: boolean;
}

export interface ConfigRepository {
  getServerConfig(serverId: string): ServerConfig;
}
