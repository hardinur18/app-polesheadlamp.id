import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { DialogFooter } from '../../components/ui/dialog';
import {
  MasterDataDialogBody,
  MasterDataFieldLabel,
} from '../../components/ui/master-data-ui';
import { AVAILABLE_TIME_SLOTS, Lead, ProspectBooking } from '../master-data/data';
import { useMasterData } from '../master-data/context';
import { isTechnicianRole } from '@/app/data/roleHelpers';

interface ProspectBookingFormProps {
  lead: Lead;
  booking?: ProspectBooking | null;
  initialBookingOverrides?: Partial<ProspectBooking>;
  availableTimeSlots?: readonly string[];
  lockSlotSelection?: boolean;
  allowStatusSelection?: boolean;
  editableCustomerFields?: boolean;
  submitLabel?: string;
  onSubmit: (booking: ProspectBooking) => Promise<void> | void;
  onCancelBooking?: (booking: ProspectBooking) => Promise<void> | void;
  onCancel: () => void;
}

const BOOKING_STATUS_OPTIONS: Array<{ value: ProspectBooking['status']; label: string }> = [
  { value: 'tentative', label: 'Tentative' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'reschedule', label: 'Reschedule' },
  { value: 'cancelled', label: 'Cancelled' },
];

const isInactiveBookingStatus = (status: ProspectBooking['status']) =>
  status === 'cancelled' || status === 'reschedule';

const createDraftBooking = (
  lead: Lead,
  booking?: ProspectBooking | null,
  initialBookingOverrides?: Partial<ProspectBooking>,
  availableTimeSlots: readonly string[] = AVAILABLE_TIME_SLOTS,
): ProspectBooking => {
  const baseBooking: ProspectBooking = {
    id: booking?.id || `BK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    leadId: lead.id,
    orderId: booking?.orderId,
    customerName: booking?.customerName || lead.name,
    customerPhone: booking?.customerPhone || lead.phone,
    scheduleDate: booking?.scheduleDate || '',
    scheduleTime: booking?.scheduleTime || availableTimeSlots[0] || AVAILABLE_TIME_SLOTS[0],
    branchId: booking?.branchId || '',
    areaId: booking?.areaId,
    address: booking?.address || '',
    mapsUrl: booking?.mapsUrl || '',
    notes: booking?.notes || lead.notes || '',
    status: booking?.status || 'tentative',
    csId: booking?.csId || lead.csId,
    advertiserId: booking?.advertiserId || lead.advertiserId,
    technicianId: booking?.technicianId,
    vehicleId: booking?.vehicleId || lead.vehicleId,
    platformId: booking?.platformId || lead.platformId,
    subChannelId: booking?.subChannelId || lead.subChannelId,
    serviceId: booking?.serviceId,
    createdAt: booking?.createdAt || new Date().toISOString(),
    updatedAt: booking?.updatedAt || new Date().toISOString(),
  };

  if (booking) {
    return baseBooking;
  }

  return {
    ...baseBooking,
    ...initialBookingOverrides,
    id: initialBookingOverrides?.id || baseBooking.id,
    leadId: initialBookingOverrides?.leadId || baseBooking.leadId,
    customerName: initialBookingOverrides?.customerName ?? baseBooking.customerName,
    customerPhone: initialBookingOverrides?.customerPhone ?? baseBooking.customerPhone,
    scheduleDate: initialBookingOverrides?.scheduleDate ?? baseBooking.scheduleDate,
    scheduleTime: initialBookingOverrides?.scheduleTime ?? baseBooking.scheduleTime,
    branchId: initialBookingOverrides?.branchId ?? baseBooking.branchId,
    status: initialBookingOverrides?.status ?? baseBooking.status,
    createdAt: initialBookingOverrides?.createdAt || baseBooking.createdAt,
    updatedAt: initialBookingOverrides?.updatedAt || baseBooking.updatedAt,
  };
};

export function ProspectBookingForm({
  lead,
  booking,
  initialBookingOverrides,
  availableTimeSlots,
  lockSlotSelection = false,
  allowStatusSelection = true,
  editableCustomerFields = false,
  submitLabel,
  onSubmit,
  onCancelBooking,
  onCancel,
}: ProspectBookingFormProps) {
  const { activeBranches, areas, services, users, currentUser } = useMasterData();
  const effectiveTimeSlots = useMemo(
    () => (availableTimeSlots && availableTimeSlots.length > 0
      ? [...availableTimeSlots]
      : AVAILABLE_TIME_SLOTS),
    [availableTimeSlots]
  );
  const [formData, setFormData] = useState<ProspectBooking>(() => createDraftBooking(lead, booking, initialBookingOverrides, effectiveTimeSlots));

  useEffect(() => {
    setFormData(createDraftBooking(lead, booking, initialBookingOverrides, effectiveTimeSlots));
  }, [lead, booking, initialBookingOverrides, effectiveTimeSlots]);

  useEffect(() => {
    if (effectiveTimeSlots.includes(formData.scheduleTime)) return;

    setFormData((prev) => ({
      ...prev,
      scheduleTime: effectiveTimeSlots[0] || AVAILABLE_TIME_SLOTS[0],
      updatedAt: new Date().toISOString(),
    }));
  }, [effectiveTimeSlots, formData.scheduleTime]);

  const filteredAreas = useMemo(() => {
    if (!formData.branchId) return [];
    return areas.filter((area) => area.branchId === formData.branchId && area.status === 'active');
  }, [areas, formData.branchId]);

  const techUsers = useMemo(() => {
    return users.filter((user) =>
      isTechnicianRole(user.role) &&
      user.status === 'active' &&
      (!formData.branchId || user.branchId === formData.branchId),
    );
  }, [users, formData.branchId]);

  const selectableBookingStatusOptions = useMemo(
    () => (booking
      ? BOOKING_STATUS_OPTIONS
      : BOOKING_STATUS_OPTIONS.filter((option) => option.value !== 'cancelled')),
    [booking]
  );
  const isTechnicianRequired = !isInactiveBookingStatus(formData.status);

  const handleChange = <K extends keyof ProspectBooking>(field: K, value: ProspectBooking[K]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !formData.customerName.trim() ||
      !formData.customerPhone.trim() ||
      !formData.scheduleDate ||
      !formData.scheduleTime ||
      !formData.branchId ||
      (isTechnicianRequired && !formData.technicianId)
    ) {
      return;
    }

    const nextBooking: ProspectBooking = {
      ...formData,
      customerName: formData.customerName.trim(),
      customerPhone: formData.customerPhone.trim(),
      csId: formData.csId || lead.csId || currentUser?.id,
      advertiserId: formData.advertiserId || lead.advertiserId,
      vehicleId: formData.vehicleId || lead.vehicleId,
      platformId: formData.platformId || lead.platformId,
      subChannelId: formData.subChannelId || lead.subChannelId,
      updatedAt: new Date().toISOString(),
    };

    await onSubmit(nextBooking);
  };

  const handleCancelBooking = async () => {
    if (!booking || !onCancelBooking) return;

    await onCancelBooking({
      ...formData,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="masterDataForm leadBookingForm">
      <MasterDataDialogBody compact className="leadManagedFormBody">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <MasterDataFieldLabel required>Nama Prospek</MasterDataFieldLabel>
          <Input
            value={formData.customerName}
            onChange={(event) => handleChange('customerName', event.target.value)}
            readOnly={!editableCustomerFields}
            className={editableCustomerFields ? undefined : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}
          />
        </div>
        <div className="space-y-2">
          <MasterDataFieldLabel required>No. WhatsApp</MasterDataFieldLabel>
          <Input
            value={formData.customerPhone}
            onChange={(event) => handleChange('customerPhone', event.target.value)}
            readOnly={!editableCustomerFields}
            className={editableCustomerFields ? undefined : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <MasterDataFieldLabel required>Tanggal Booking</MasterDataFieldLabel>
          <Input
            type="date"
            value={formData.scheduleDate}
            onChange={(event) => handleChange('scheduleDate', event.target.value)}
            disabled={lockSlotSelection}
            className={lockSlotSelection ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" : undefined}
          />
        </div>
        <div className="space-y-2">
          <MasterDataFieldLabel required>Jam Booking</MasterDataFieldLabel>
          <Select value={formData.scheduleTime} onValueChange={(value) => handleChange('scheduleTime', value)} disabled={lockSlotSelection}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih jam booking" />
            </SelectTrigger>
            <SelectContent>
              {effectiveTimeSlots.map((slot) => (
                <SelectItem key={slot} value={slot}>
                  {slot}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <MasterDataFieldLabel required>Cabang</MasterDataFieldLabel>
          <Select
            value={formData.branchId}
            disabled={lockSlotSelection}
            onValueChange={(value) => {
              setFormData((prev) => ({
                ...prev,
                branchId: value,
                areaId: undefined,
                technicianId: undefined,
                updatedAt: new Date().toISOString(),
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih cabang" />
            </SelectTrigger>
            <SelectContent>
              {activeBranches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <MasterDataFieldLabel optional>Area</MasterDataFieldLabel>
          <Select
            value={formData.areaId || 'none_area'}
            onValueChange={(value) => handleChange('areaId', value === 'none_area' ? undefined : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none_area">Belum ditentukan</SelectItem>
              {filteredAreas.map((area) => (
                <SelectItem key={area.id} value={area.id}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <MasterDataFieldLabel optional>Layanan</MasterDataFieldLabel>
          <Select
            value={formData.serviceId || 'none_service'}
            onValueChange={(value) => handleChange('serviceId', value === 'none_service' ? undefined : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih layanan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none_service">Belum ditentukan</SelectItem>
              {services
                .filter((service) => service.status === 'active')
                .map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <MasterDataFieldLabel required={isTechnicianRequired} optional={!isTechnicianRequired}>Teknisi</MasterDataFieldLabel>
          <Select
            value={formData.technicianId || 'none_technician'}
            disabled={lockSlotSelection}
            onValueChange={(value) => handleChange('technicianId', value === 'none_technician' ? undefined : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Belum ditentukan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none_technician">Belum ditentukan</SelectItem>
              {techUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {allowStatusSelection && (
        <div className="space-y-2">
          <MasterDataFieldLabel>Status Booking</MasterDataFieldLabel>
          <Select value={formData.status} onValueChange={(value) => handleChange('status', value as ProspectBooking['status'])}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih status booking" />
            </SelectTrigger>
            <SelectContent>
              {selectableBookingStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <MasterDataFieldLabel optional>Alamat Singkat</MasterDataFieldLabel>
        <Textarea
          value={formData.address || ''}
          onChange={(event) => handleChange('address', event.target.value)}
          placeholder="Contoh: Ciledug, dekat Pasar Lembang"
          className="min-h-[88px]"
        />
      </div>

      <div className="space-y-2">
        <MasterDataFieldLabel optional>Link Maps</MasterDataFieldLabel>
        <Input
          value={formData.mapsUrl || ''}
          onChange={(event) => handleChange('mapsUrl', event.target.value)}
          placeholder="Opsional, boleh diisi nanti"
        />
      </div>

      <div className="space-y-2">
        <MasterDataFieldLabel optional>Catatan CS</MasterDataFieldLabel>
        <Textarea
          value={formData.notes || ''}
          onChange={(event) => handleChange('notes', event.target.value)}
          placeholder="Catatan tambahan untuk booking awal"
          className="min-h-[110px]"
        />
      </div>
      </MasterDataDialogBody>

      <DialogFooter className="masterDataFormActions">
        <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
          Batal
        </Button>
        {booking && booking.status !== 'cancelled' && onCancelBooking && (
          <Button type="button" variant="destructive" onClick={handleCancelBooking} className="w-full sm:w-auto">
            Batalkan Booking
          </Button>
        )}
        <Button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto"
          disabled={
            !formData.customerName.trim() ||
            !formData.customerPhone.trim() ||
            !formData.scheduleDate ||
            !formData.scheduleTime ||
            !formData.branchId ||
            (isTechnicianRequired && !formData.technicianId)
          }
        >
          {submitLabel || (booking ? 'Simpan Booking' : 'Buat Booking')}
        </Button>
      </DialogFooter>
    </form>
  );
}
