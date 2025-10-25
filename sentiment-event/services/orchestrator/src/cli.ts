import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import { getLogger, loadEnv } from "@pkg/shared";
import { loadEventSpec } from "@pkg/schemas";
import { OrchestratorRunner } from "./orchestrator";
import { startServer } from "./server";

const logger = getLogger();

interface CliArgs {
  event: string;
  rules?: string;
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
    .option("rules", {
      type: "string",
      default: "config/rules.demo.json",
      describe: "Path to rules JSON"
    })
    .option("port", {
      type: "number",
      default: 4003,
      describe: "HTTP server port"
    })
    .parse()) as CliArgs;

  const event = await loadEventSpec(argv.event);
  const runner = new OrchestratorRunner({ event, rulesPath: argv.rules ?? "config/rules.demo.json" });
  await runner.initialize();
  runner.start();
  await startServer(runner, argv.port ?? 4003);
};

if (require.main === module) {
  runCli().catch((error) => {
    logger.error({ error }, "orchestrator.cli_failed");
    process.exit(1);
  });
}
