export interface ServerConfig {
  twitter?: {
    language?: string;
  };
  bluesky?: {};
}

export interface ConfigRepository {
  getServerConfig(serverId: string): ServerConfig;
}
