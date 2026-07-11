begin;

select plan(2);

select lives_ok(
  $$select * from public.kw_match_rag_ens('baseline contract', 0, 1, '{}'::jsonb)$$,
  'kw_match_rag_ens returns the declared similarity type'
);

select lives_ok(
  $$select * from public.kw_match_rag_marketing('baseline contract', 0, 1, '{}'::jsonb)$$,
  'kw_match_rag_marketing returns the declared similarity type'
);

select * from finish();

rollback;
