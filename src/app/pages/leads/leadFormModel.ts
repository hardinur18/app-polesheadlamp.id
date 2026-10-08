import * as z from 'zod';

export const leadSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  phone: z.string().min(1, 'Nomor HP wajib diisi'),
  platformId: z.string().optional(),
  subChannelId: z.string().optional(),
  advertiserId: z.string().optional(),
  vehicleId: z.string().optional(),
  csId: z.string().optional(),
  status: z.enum(['Pending', 'Follow Up', 'Booking', 'Closing', 'Cancel']),
  notes: z.string().optional(),
  socialPlatform: z.enum(['instagram', 'tiktok']).optional(),
  socialUsername: z.string().optional(),
  socialProfileUrl: z.string().optional(),
  socialChatUrl: z.string().optional(),
});

export type LeadFormValues = z.infer<typeof leadSchema>;

export const NONE_ADVERTISER = 'none_advertiser';
export const NONE_PLATFORM = 'none_platform';
export const NONE_SUBCHANNEL = 'none_subchannel';
export const NONE_CS = 'none_cs';
export const NONE_VEHICLE = '__no_vehicle__';
export const NONE_SOCIAL_PLATFORM = 'none_social_platform';

export const uniqueById = <T extends { id: string }>(items: T[]) =>
  Array.from(new Map(items.map((item) => [item.id, item])).values());

export const normalizeSelectValue = (value?: string, noneValue?: string) =>
  !value || value === noneValue ? '' : value;
