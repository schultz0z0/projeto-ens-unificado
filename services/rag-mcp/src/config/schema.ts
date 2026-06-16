import { z } from 'zod/v4';

export const appConfigSchema = z.object({
  server: z.object({
    host: z.string().default('0.0.0.0'),
    port: z.number().int().positive().default(8000)
  }),
  supabase: z.object({
    url_env: z.string().default('SUPABASE_URL'),
    service_role_key_env: z.string().default('SUPABASE_SERVICE_ROLE_KEY')
  }),
  policy: z.object({
    common_tenant: z.string().min(1).default('ens'),
    admin_profiles: z.array(z.string().min(1)).default(['ceo', 'default']),
    default_limit: z.number().int().positive().default(8),
    max_limit: z.number().int().positive().default(20)
  })
});

export type AppConfig = z.infer<typeof appConfigSchema>;

