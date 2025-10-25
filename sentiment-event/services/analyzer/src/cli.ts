import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import { getLogger, loadEnv } from "@pkg/shared";
import { loadEventSpec } from "@pkg/schemas";
import { AnalyzerRunner } from "./analyzer";
import { startHealthServer } from "./server";

const logger = getLogger();

interface CliArgs {
  event: string;
  port?: number;
}

export const runCli = async () => {
  loadEnv();

  const argv = (await yargs(hideBin(process.argv))
    .option("event", {
      type: "string",
      demandOption: true,
      describe: "Path to event JSON or inline JSON"
    })
    .option("port", {
      type: "number",
      default: 4002,
      describe: "Health server port"
    })
    .parse()) as CliArgs;

  const event = await loadEventSpec(argv.event);
  const runner = new AnalyzerRunner({ event });

  await startHealthServer(argv.port ?? 4002);
  runner.start();
};

if (require.main === module) {
  runCli().catch((error) => {
    logger.error({ error }, "analyzer.cli_failed");
    process.exit(1);
  });
}
