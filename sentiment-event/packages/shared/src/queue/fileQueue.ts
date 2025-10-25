import { mkdir, readdir, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { QueueClient, QueueMessage } from "./types";

export interface FileQueueOptions {
  baseDir?: string;
  queueName: string;
}

const DEFAULT_BASE_DIR = join(process.cwd(), "data", "queue");

export class FileQueueClient<T> implements QueueClient<T> {
  private readonly baseDir: string;
  private readonly queueDir: string;

  constructor(private readonly options: FileQueueOptions) {
    this.baseDir = options.baseDir ?? DEFAULT_BASE_DIR;
    this.queueDir = join(this.baseDir, options.queueName);
  }

  private async ensureDir() {
    await mkdir(this.queueDir, { recursive: true });
  }

  async enqueue(payload: T): Promise<QueueMessage<T>> {
    await this.ensureDir();
    const id = `${Date.now()}-${randomUUID()}`;
    const message: QueueMessage<T> = {
      id,
      payload,
      enqueuedAt: new Date().toISOString()
    };
    const filePath = join(this.queueDir, `${id}.json`);
    await writeFile(filePath, JSON.stringify(message), "utf8");
    return message;
  }

  async dequeueBatch(maxItems: number): Promise<QueueMessage<T>[]> {
    await this.ensureDir();
    const entries = await readdir(this.queueDir);
    const files = entries
      .filter((name: string) => name.endsWith(".json"))
      .sort()
      .slice(0, maxItems);
    const items: QueueMessage<T>[] = [];
    for (const file of files) {
      const filePath = join(this.queueDir, file);
      const raw = await readFile(filePath, "utf8");
      items.push(JSON.parse(raw) as QueueMessage<T>);
    }
    return items;
  }

  async ack(ids: string[]) {
    await this.ensureDir();
    await Promise.all(
      ids.map(async (id) => {
        const filePath = join(this.queueDir, `${id}.json`);
        await unlink(filePath).catch(() => undefined);
      })
    );
  }
}
