import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import { getLogger, loadEnv } from "@pkg/shared";
import { loadEventSpec } from "@pkg/schemas";
import { CollectorRunner } from "./collector";
import { startHealthServer } from "./server";

const logger = getLogger();

interface CliArgs {
  event: string;
  once?: boolean;
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
    .option("once", {
      type: "boolean",
      default: false,
      describe: "Run collector once and exit"
    })
    .option("port", {
      type: "number",
      default: 4001,
      describe: "Health server port"
    })
    .parse()) as CliArgs;

  const event = await loadEventSpec(argv.event);

  const runner = new CollectorRunner({ event });
  if (argv.once) {
    await runner.runOnce();
    return;
  }

  await startHealthServer(argv.port ?? 4001);
  await runner.start();
};

if (require.main === module) {
  runCli().catch((error) => {
    logger.error({ error }, "collector.cli_failed");
    process.exit(1);
  });
}
