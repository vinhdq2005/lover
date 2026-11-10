import { createClient } from "@supabase/supabase-js";
import {
  assertDisposableDirectory,
  disposableRoot,
  disposableSql,
  disposableStatus,
} from "./disposableStack";

// The schema intentionally supports one couple. Each sequential test exclusively owns
// the marked disposable project's fixture, never the developer's local project.
export async function cleanGalleryFixture() {
  if (process.env.LOVER_TEST_WORKDIR !== disposableRoot) {
    throw new Error("DISPOSABLE_GALLERY_FIXTURE_REQUIRED");
  }
  assertDisposableDirectory(disposableRoot);
  const status = disposableStatus();
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const objects: { bucket_id: string; name: string }[] = JSON.parse(disposableSql(
    "select coalesce(json_agg(json_build_object('bucket_id',bucket_id,'name',name)),'[]'::json) from storage.objects where bucket_id in ('staging','media');",
  ));
  for (const bucket of ["staging", "media"]) {
    const names = objects.filter((object) => object.bucket_id === bucket).map((object) => object.name);
    for (let offset = 0; offset < names.length; offset += 100) {
      const result = await admin.storage.from(bucket).remove(names.slice(offset, offset + 100));
      if (result.error) throw new Error("GALLERY_STORAGE_CLEANUP_FAILED: " + result.error.message);
    }
  }
  disposableSql(`begin;
    truncate public.couples,public.profiles,public.operation_receipts,
      private.bootstrap_eligibility,private.operation_rate_limits cascade;
    update private.usage_budget set reserved_bytes=0,committed_bytes=0 where scope='media';
    commit;`);
  const remaining = disposableSql(`select
    (select count(*) from storage.objects where bucket_id in ('staging','media'))+
    (select count(*) from public.photos)+(select count(*) from public.upload_batches)+
    (select count(*) from public.couples);`);
  if (remaining !== "0") throw new Error("GALLERY_FIXTURE_LEAK");
}
