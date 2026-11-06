import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// ルートの .env を読む(本番では .env が無いので、何も起きない)
config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});
