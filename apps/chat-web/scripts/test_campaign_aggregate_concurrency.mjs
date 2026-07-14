import pg from "pg";

const { Client } = pg;

const databaseUrl =
  process.env.MARKETING_OPS_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const campaignId = "c1111111-1111-4111-8111-111111111111";
const primaryOwnerId = "11111111-1111-4111-8111-111111111111";
const managerId = "22222222-2222-4222-8222-222222222222";

const clients = [];

async function connect(applicationName) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query("select set_config('application_name', $1, false)", [applicationName]);
  clients.push(client);
  return client;
}

async function beginAsManager(client) {
  await client.query("begin");
  await client.query("set local deadlock_timeout = '100ms'");
  await client.query("set local lock_timeout = '5s'");
  await client.query("set local statement_timeout = '8s'");
  await client.query("set local role authenticated");
  await client.query(
    "select set_config('request.jwt.claim.sub', $1, true), set_config('marketing_ops.tenant_id', $2, true)",
    [managerId, tenantId],
  );
}

async function waitUntilBlocked(observer, applicationName) {
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    const result = await observer.query(
      `
        select wait_event_type, wait_event, pg_blocking_pids(pid) as blocking_pids
        from pg_stat_activity
        where application_name = $1
          and state = 'active'
      `,
      [applicationName],
    );
    const row = result.rows[0];
    if (row?.wait_event_type === "Lock" && row.blocking_pids.length > 0) {
      return row;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for ${applicationName} to block`);
}

function observe(side, promise) {
  return promise.then(
    (value) => ({ side, ok: true, value }),
    (error) => ({ side, ok: false, error }),
  );
}

async function exerciseAggregateOrder() {
  const sessionA = await connect("phase2_campaign_order_a");
  const sessionB = await connect("phase2_campaign_order_b");
  const observer = await connect("phase2_campaign_order_observer");

  await beginAsManager(sessionA);
  await beginAsManager(sessionB);

  await sessionA.query(
    `
      update marketing_ops.campaigns
      set notes = coalesce(notes, ''),
          version = version + 1,
          updated_by = $1
      where id = $2
    `,
    [managerId, campaignId],
  );

  const participantUpdate = `
    update marketing_ops.campaign_members
    set member_role = member_role
    where campaign_id = $1
      and user_id = $2
  `;

  const bResult = observe(
    "B",
    sessionB.query(participantUpdate, [campaignId, primaryOwnerId]),
  );
  const blocked = await waitUntilBlocked(observer, "phase2_campaign_order_b");
  console.log(
    `session B blocked on ${blocked.wait_event_type}/${blocked.wait_event} before session A participant update`,
  );

  const aResult = observe(
    "A",
    sessionA.query(participantUpdate, [campaignId, primaryOwnerId]),
  );
  const first = await Promise.race([aResult, bResult]);

  let deadlock = null;
  if (!first.ok && first.error?.code === "40P01") {
    deadlock = first;
  }

  if (first.side === "A") {
    await sessionA.query("rollback");
    const second = await bResult;
    if (!second.ok && second.error?.code === "40P01") deadlock = second;
    await sessionB.query("rollback");
  } else {
    await sessionB.query("rollback");
    const second = await aResult;
    if (!second.ok && second.error?.code === "40P01") deadlock = second;
    await sessionA.query("rollback");
  }

  if (deadlock) {
    throw Object.assign(
      new Error(`aggregate lock order deadlocked in session ${deadlock.side}: 40P01`),
      { code: "40P01" },
    );
  }

  if (!first.ok) throw first.error;
}

async function assertOwnershipInvariants() {
  const client = await connect("phase2_campaign_invariants");

  const metadata = await client.query(
    `
      select
        (
          select count(*) = 1
          from marketing_ops.campaign_members
          where campaign_id = $1
            and member_role = 'owner'
            and is_primary
        ) as exactly_one,
        (
          select index_meta.indisunique
            and pg_get_expr(index_meta.indpred, index_meta.indrelid) = 'is_primary'
          from pg_index as index_meta
          where index_meta.indexrelid = 'marketing_ops.campaign_members_one_primary_idx'::regclass
        ) as unique_partial,
        (
          select count(*) = 2
          from pg_trigger
          where tgname in ('campaign_members_require_primary_owner', 'campaigns_require_primary_owner')
            and tgdeferrable
            and tginitdeferred
        ) as deferred_triggers
    `,
    [campaignId],
  );
  const invariant = metadata.rows[0];
  if (!invariant.exactly_one || !invariant.unique_partial || !invariant.deferred_triggers) {
    throw new Error(`ownership metadata invariant failed: ${JSON.stringify(invariant)}`);
  }

  await beginAsManager(client);
  let deferredCode;
  try {
    await client.query(
      `
        update marketing_ops.campaign_members
        set is_primary = false
        where campaign_id = $1
          and user_id = $2
      `,
      [campaignId, primaryOwnerId],
    );
    await client.query("set constraints all immediate");
  } catch (error) {
    deferredCode = error.code;
  } finally {
    await client.query("rollback");
  }
  if (deferredCode !== "23514") {
    throw new Error(`deferred exactly-one invariant returned ${deferredCode ?? "no error"}`);
  }

  await beginAsManager(client);
  let uniqueCode;
  try {
    await client.query(
      `
        insert into marketing_ops.campaign_members (
          tenant_id, campaign_id, user_id, member_role, is_primary, created_by
        ) values ($1, $2, $3, 'owner', true, $3)
      `,
      [tenantId, campaignId, managerId],
    );
  } catch (error) {
    uniqueCode = error.code;
  } finally {
    await client.query("rollback");
  }
  if (uniqueCode !== "23505") {
    throw new Error(`unique primary-owner invariant returned ${uniqueCode ?? "no error"}`);
  }
}

try {
  await exerciseAggregateOrder();
  await assertOwnershipInvariants();
  console.log("campaign aggregate concurrency: PASS");
} catch (error) {
  console.error(`campaign aggregate concurrency: FAIL (${error.code ?? "ERROR"}) ${error.message}`);
  process.exitCode = 1;
} finally {
  await Promise.allSettled(clients.map((client) => client.end()));
}
