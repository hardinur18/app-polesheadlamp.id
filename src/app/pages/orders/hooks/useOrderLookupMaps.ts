import { useMemo } from 'react';
import { Area, Branch, PaymentMethod, Platform, ServiceType, SubChannel, User, VehicleType } from '../../master-data/data';

interface UseOrderLookupMapsParams {
  users: User[];
  branches: Branch[];
  areas: Area[];
  services: ServiceType[];
  platforms: Platform[];
  subChannels: SubChannel[];
  payments: PaymentMethod[];
  vehicles: VehicleType[];
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
  const userMap = useMemo(() => users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {} as Record<string, User>), [users]);
  const branchMap = useMemo(() => branches.reduce((acc, b) => ({ ...acc, [b.id]: b }), {} as Record<string, Branch>), [branches]);
  const areaMap = useMemo(() => areas.reduce((acc, a) => ({ ...acc, [a.id]: a }), {} as Record<string, Area>), [areas]);
  const serviceMap = useMemo(() => services.reduce((acc, s) => ({ ...acc, [s.id]: s }), {} as Record<string, ServiceType>), [services]);
  const platformMap = useMemo(() => platforms.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, Platform>), [platforms]);
  const subChannelMap = useMemo(() => subChannels.reduce((acc, s) => ({ ...acc, [s.id]: s }), {} as Record<string, SubChannel>), [subChannels]);
  const paymentMap = useMemo(() => payments.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, PaymentMethod>), [payments]);
  const vehicleMap = useMemo(() => vehicles.reduce((acc, v) => ({ ...acc, [v.id]: v }), {} as Record<string, VehicleType>), [vehicles]);

  return { userMap, branchMap, areaMap, serviceMap, platformMap, subChannelMap, paymentMap, vehicleMap };
}
