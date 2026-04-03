import { ServerConfig } from "../config-repo/types";

export interface FixRequest {
  url: string;
  serverConfig: ServerConfig;
}

export interface FixResult {
  url: string;
  source?: string;
  // secondary is used for additional redirects that will not render embeds ie Old reddit
  secondaryUrl?: string;
  secondarySource?: string;
}

export interface EmbedFixer {
  canHandle(url: string): boolean;
  fix(request: FixRequest): FixResult | Promise<FixResult>;
}
