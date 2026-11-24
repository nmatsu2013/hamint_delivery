import { z } from 'zod';

export const MasterRowsQuerySchema = z.object({
  q: z.string().max(100, '検索文字列は100文字以内で指定してください').optional(),
  isActive: z.enum(['true', 'false']).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce
    .number()
    .int()
    .refine((value) => [25, 50, 100].includes(value), {
      message: 'limitは25、50、100のいずれかを指定してください',
    })
    .optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const MasterRowUpdateSchema = z.object({
  values: z.record(z.unknown()),
});
