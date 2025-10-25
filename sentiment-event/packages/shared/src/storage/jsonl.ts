import { mkdir, appendFile } from "fs/promises";
import { dirname } from "path";

export const appendJsonl = async (filePath: string, payload: unknown) => {
  await mkdir(dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
};
