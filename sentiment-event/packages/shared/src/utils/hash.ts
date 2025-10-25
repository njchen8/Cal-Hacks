import { createHash } from "crypto";

export const hashText = (text: string, salt = "") => {
  const hash = createHash("sha256");
  hash.update(text);
  if (salt) {
    hash.update(salt);
  }
  return hash.digest("hex");
};
