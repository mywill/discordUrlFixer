import { ServerConfig } from "../config-repo/types";

export interface FixRequest {
  url: string;
  serverConfig: ServerConfig;
}

export interface FixResult {
  url: string;
  source?: string;
}

export interface EmbedFixer {
  canHandle(url: string): boolean;
  fix(request: FixRequest): FixResult;
}
