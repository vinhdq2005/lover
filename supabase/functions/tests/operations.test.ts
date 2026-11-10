import { issueOperation, verifyOperation } from "../_shared/operations.ts";
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Assertion failed");
}
const actor = "00000000-0000-4000-8000-000000000001";
const config = {
  key: "local-test-signing-material-at-least-32-bytes",
  keyId: "test-v1",
};
const intent = {
  command: "memory.update",
  payload: {
    id: "10000000-0000-4000-8000-000000000001",
    expected_version: 1,
    title: "Memory",
  },
};
Deno.test("unauthorized issuance is denied before a token is produced", async () => {
  let failed = false;
  try {
    await issueOperation(actor, intent, config, async () => false);
  } catch {
    failed = true;
  }
  assert(failed);
});
Deno.test("canonical payload tokens reject actor, payload and expiry changes", async () => {
  const now = 1000000000000;
  const issued = await issueOperation(
    actor,
    intent,
    config,
    async () => true,
    now,
  );
  await verifyOperation(
    issued.token,
    actor,
    intent,
    config,
    async () => true,
    now + 1000,
  );
  for (
    const test of [{
      actor: "00000000-0000-4000-8000-000000000002",
      intent,
      now: now + 1000,
    }, {
      actor,
      intent: { ...intent, payload: { ...intent.payload, title: "Modified" } },
      now: now + 1000,
    }, { actor, intent, now: now + 31 * 86400000 }]
  ) {
    let failed = false;
    try {
      await verifyOperation(
        issued.token,
        test.actor,
        test.intent,
        config,
        async () => true,
        test.now,
      );
    } catch {
      failed = true;
    }
    assert(failed);
  }
});
Deno.test("verification rejects revoked keys, tampering and lost authorization", async () => {
  const issued = await issueOperation(actor, intent, config, async () => true);
  for (
    const [token, key, allowed] of [[issued.token + "x", config, true], [
      issued.token,
      { ...config, keyId: "revoked" },
      true,
    ], [issued.token, config, false]] as const
  ) {
    let failed = false;
    try {
      await verifyOperation(token, actor, intent, key, async () => allowed);
    } catch {
      failed = true;
    }
    assert(failed);
  }
});
Deno.test("tokens bind command resource version and every upload identifier", async () => {
  const upload = {
    command: "upload.finalize",
    payload: {
      batch_id: actor,
      reservation_id: actor,
      file_ids: [actor],
      expected_version: 1,
    },
  };
  const issued = await issueOperation(actor, upload, config, async () => true);
  const changes = [
    { ...upload, command: "upload.close" },
    ...Object.entries({
      batch_id: "other",
      reservation_id: "other",
      file_ids: ["other"],
      expected_version: 2,
    }).map(([field, value]) => ({
      ...upload,
      payload: { ...upload.payload, [field]: value },
    })),
  ];
  for (const changed of changes) {
    let denied = false;
    try {
      await verifyOperation(
        issued.token,
        actor,
        changed,
        config,
        async () => true,
      );
    } catch {
      denied = true;
    }
    assert(denied);
  }
  const memory = await issueOperation(actor, intent, config, async () => true);
  for (
    const payload of [{ ...intent.payload, id: "other" }, {
      ...intent.payload,
      expected_version: 2,
    }]
  ) {
    let denied = false;
    try {
      await verifyOperation(
        memory.token,
        actor,
        { ...intent, payload },
        config,
        async () => true,
      );
    } catch {
      denied = true;
    }
    assert(denied);
  }
});
