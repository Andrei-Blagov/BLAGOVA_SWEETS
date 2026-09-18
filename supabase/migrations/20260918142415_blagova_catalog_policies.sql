-- One SELECT policy per role/action on catalog tables.
alter policy published_products on public.products to anon;
alter policy staff_read on public.products using ((select private.is_staff()) or status = 'published');
alter policy published_variants on public.product_variants to anon;
alter policy staff_read on public.product_variants using (
 (select private.is_staff()) or (active and exists(select 1 from public.products p where p.id=product_id and p.status='published'))
);
alter policy verified_fillings on public.fillings to anon;
alter policy staff_read on public.fillings using ((select private.is_staff()) or (active and composition_verified));
alter policy published_product_fillings on public.product_fillings to anon;
alter policy staff_read on public.product_fillings using (
 (select private.is_staff()) or (
 exists(select 1 from public.products p where p.id=product_id and p.status='published') and
 exists(select 1 from public.fillings f where f.id=filling_id and f.active and f.composition_verified)
 )
);
-- Explicit backend-only access; client roles still have no grants or policies.
create policy backend_jobs on private.integration_jobs for all to service_role using (true) with check (true);
