import * as fs from "fs";
import * as path from "path";
import { ConfigRepository, ServerConfig } from "./types";

export class JsonConfigRepository implements ConfigRepository {
  private configs: Record<string, ServerConfig> = {};

  constructor(filePath?: string) {
    const resolvedPath = filePath ?? path.join(process.cwd(), "server-config.json");
    try {
      const raw = fs.readFileSync(resolvedPath, "utf-8");
      this.configs = JSON.parse(raw);
    } catch {
      this.configs = {};
    }
  }

  getServerConfig(serverId: string): ServerConfig {
    return this.configs[serverId] ?? {};
  }
}
