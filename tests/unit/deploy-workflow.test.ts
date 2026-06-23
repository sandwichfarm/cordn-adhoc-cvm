import { describe, expect, test } from "vitest";
import { readFileSync, statSync } from "node:fs";

describe("nsite deployment workflow", () => {
  test("runs after CI succeeds on main and skips clearly when secrets are absent", () => {
    const workflow = readFileSync(".github/workflows/deploy-nsite.yml", "utf8");

    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("workflows:");
    expect(workflow).toContain("- CI");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("branches:");
    expect(workflow).toContain("- main");
    expect(workflow).toContain("Skipping nsite deploy: set NBUNK_SECRET, NSYTE_RELAY, and BLOSSOM_SERVER_URL");
    expect(workflow).toContain("sandwichfarm/nsite-action@v0.5.1");
    expect(workflow).toContain("nbunksec: ${{ secrets.NBUNK_SECRET }}");
  });

  test("keeps the secrets helper executable", () => {
    const mode = statSync("scripts/setup-secrets.sh").mode;

    expect(mode & 0o111).not.toBe(0);
  });
});
