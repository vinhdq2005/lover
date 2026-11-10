import { runOperator } from "./operator-provision.ts";
try {
  console.log(await runOperator(process.argv.slice(2), process.env));
} catch (error) {
  // Only internally constructed sanitized errors escape runOperator.
  console.error(error instanceof Error && /^(OPERATOR_|Use first|Unexpected accounts|Two account)/.test(error.message) ? error.message : "OPERATOR_FAILED: status=0 code=UNAVAILABLE category=unclassified");
  process.exitCode = 1;
}
