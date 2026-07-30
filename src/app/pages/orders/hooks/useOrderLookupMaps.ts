import { useMemo } from 'react';

interface UseOrderLookupMapsParams {
  users: any[];
  branches: any[];
  areas: any[];
  services: any[];
  platforms: any[];
  subChannels: any[];
  payments: any[];
  vehicles: any[];
}

export function useOrderLookupMaps({
  users,
  branches,
  areas,
  services,
  platforms,
  subChannels,
  payments,
  vehicles,
}: UseOrderLookupMapsParams) {
  const userMap = useMemo(() => users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {} as Record<string, typeof users[0]>), [users]);
  const branchMap = useMemo(() => branches.reduce((acc, b) => ({ ...acc, [b.id]: b }), {} as Record<string, typeof branches[0]>), [branches]);
  const areaMap = useMemo(() => areas.reduce((acc, a) => ({ ...acc, [a.id]: a }), {} as Record<string, typeof areas[0]>), [areas]);
  const serviceMap = useMemo(() => services.reduce((acc, s) => ({ ...acc, [s.id]: s }), {} as Record<string, typeof services[0]>), [services]);
  const platformMap = useMemo(() => platforms.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, typeof platforms[0]>), [platforms]);
  const subChannelMap = useMemo(() => subChannels.reduce((acc, s) => ({ ...acc, [s.id]: s }), {} as Record<string, typeof subChannels[0]>), [subChannels]);
  const paymentMap = useMemo(() => payments.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, typeof payments[0]>), [payments]);
  const vehicleMap = useMemo(() => vehicles.reduce((acc, v) => ({ ...acc, [v.id]: v }), {} as Record<string, typeof vehicles[0]>), [vehicles]);

  return { userMap, branchMap, areaMap, serviceMap, platformMap, subChannelMap, paymentMap, vehicleMap };
}
