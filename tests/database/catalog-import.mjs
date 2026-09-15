// Real PostgreSQL integration; called only by the disposable-cluster runner.
import { buildTransaction, loadApproved } from '../../scripts/catalog-execution-lib.mjs';
const quote=x=>"'"+x.replaceAll("'","''")+"'";
export function catalogImportTests() {
  const {body}=buildTransaction(loadApproved());
  const empty=`select pg_temp.assert_ok((select count(*) from public.programs)=0 and (select count(*) from public.branches)=0 and (select count(*) from public.program_offerings)=0 and (select count(*) from public.curriculum_items)=0 and (select count(*) from public.career_paths)=0 and (select count(*) from private.catalog_import_receipts)=0,'rollback left all tables empty');
select pg_temp.assert_ok((select count(*)=5 from pg_trigger where tgname='audit_change' and tgrelid in ('public.programs'::regclass,'public.branches'::regclass,'public.program_offerings'::regclass,'public.curriculum_items'::regclass,'public.career_paths'::regclass) and tgenabled='O'),'audit triggers restored');`;
  return `begin;
create function pg_temp.assert_ok(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',message; end if;end;$$;
create function pg_temp.refused(command text, expected text) returns void language plpgsql as $$begin
  begin execute command; exception when others then if position(expected in sqlerrm)=0 then raise exception 'Unexpected rejection: %',sqlerrm; end if;return;end;
  raise exception 'Expected refusal: %',expected;
end;$$;
${empty}
savepoint partial;
insert into public.branches(id,legacy_key,name,city) values('99999999-1111-4111-8111-111111111111','test::partial','partial','test');
select pg_temp.refused(${quote(body)},'Non-empty or partial');
select pg_temp.assert_ok((select count(*)=1 from public.branches),'partial target preserved');
rollback to partial;
-- Inject a real BEFORE INSERT alteration: reconciliation must catch it and roll back.
create function pg_temp.alter_name() returns trigger language plpgsql as $$begin new.name_ar:=new.name_ar||' altered';return new;end;$$;
create trigger test_wrong_value before insert on public.programs for each row execute function pg_temp.alter_name();
select pg_temp.refused(${quote(body)},'Exact reconciliation failed: programs');
${empty}
drop trigger test_wrong_value on public.programs;
-- Receipt failure occurs after rows and trigger restoration, still rolls back all.
create function pg_temp.fail_receipt() returns trigger language plpgsql as $$begin raise exception 'synthetic receipt failure';end;$$;
create trigger test_receipt_failure before insert on private.catalog_import_receipts for each row execute function pg_temp.fail_receipt();
select pg_temp.refused(${quote(body)},'synthetic receipt failure');
${empty}
drop trigger test_receipt_failure on private.catalog_import_receipts;
${body}
select pg_temp.assert_ok(current_setting('sstli.catalog_import_result')='imported and reconciled','initial import succeeded');
${body}
select pg_temp.assert_ok(current_setting('sstli.catalog_import_result')='already imported and reconciled','exact retry no-op');
select pg_temp.assert_ok((select count(*)=1 from private.catalog_import_receipts),'one receipt');
select pg_temp.assert_ok((select count(*)=0 from public.activity_logs),'no normal activity flood');
select pg_temp.assert_ok(not exists(select 1 from public.program_offerings o join public.programs p on p.id=o.program_id where p.legacy_id='accounting'),'accounting unavailable');
select pg_temp.assert_ok((select count(*)=6 from public.branches where city='الدمام'),'six Dammam identities retained');
select pg_temp.refused('delete from private.catalog_import_receipts','append-only');
select pg_temp.refused('update private.catalog_import_receipts set import_actor=''other''','append-only');
select pg_temp.refused('truncate private.catalog_import_receipts','append-only');
-- A subsequent normal edit is audited, and exact retry must reject its drift.
update public.programs set name_ar=name_ar||' changed' where legacy_id='law';
select pg_temp.assert_ok((select count(*)=1 from public.activity_logs),'normal audit restored');
select pg_temp.refused(${quote(body)},'Exact reconciliation failed: programs');
select pg_temp.assert_ok((select count(*)=1 from private.catalog_import_receipts),'mismatch does not alter receipt');
select pg_temp.assert_ok(not has_table_privilege('anon','private.catalog_import_receipts','select') and not has_table_privilege('authenticated','private.catalog_import_receipts','insert') and not has_table_privilege('service_role','private.catalog_import_receipts','insert'),'receipt access denied');
rollback;`;
}
