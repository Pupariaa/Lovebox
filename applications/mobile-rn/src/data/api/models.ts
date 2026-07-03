export type UserDto = {
  id: number;
  email: string;
};

export type AuthResponse = {
  ok: boolean;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: UserDto;
};

export type UserProfileDto = {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  locale: string;
  email_verified: boolean;
};

export type UserProfileResponse = {
  ok: boolean;
  user: UserProfileDto;
};

export type DeviceDto = {
  id: number;
  uuid: string;
  device_name: string;
  display_name: string;
  serial_number: string;
  region?: string | null;
  region_override?: string | null;
  firmware_version?: string | null;
  last_seen_at?: string | null;
  last_seen_seconds_ago?: number | null;
  online: boolean;
};

export type DeviceMeResponse = {
  ok: boolean;
  devices: DeviceDto[];
  device?: DeviceDto | null;
};

export type DeviceUpdateResponse = {
  ok: boolean;
  device?: DeviceDto | null;
};

export type OwnedDeviceDto = {
  id: number;
  device_name: string;
  display_name: string;
  uuid: string;
  serial_number: string;
  last_seen_at?: string | null;
};

export type LinkedTargetDto = {
  pairing_id: number;
  device_id: number;
  device_name: string;
  display_name: string;
  uuid: string;
  serial_number: string;
  relationship_type: string;
  last_seen_at?: string | null;
  last_seen_seconds_ago?: number | null;
  online: boolean;
};

export type PendingRequestDto = {
  request_id: number;
  pairing_id: number;
  from_email: string;
  created_at: string;
};

export type PairingStateResponse = {
  ok: boolean;
  owned_devices: OwnedDeviceDto[];
  owned_device?: OwnedDeviceDto | null;
  linked_targets: LinkedTargetDto[];
  linked_target?: LinkedTargetDto | null;
  pending_requests: PendingRequestDto[];
};

export type PairingCodeResponse = {
  ok: boolean;
  code: string;
  expires_at?: string | null;
  device_id?: number | null;
};

export type SentMessageDto = {
  id: number;
  message_id: number;
  target_device_name: string;
  preview_base64?: string | null;
  created_at: string;
  status?: string;
  received_at?: string | null;
  opened_at?: string | null;
  seen_at?: string | null;
  ephemeral?: boolean;
};

export type SentMessagesResponse = {
  ok: boolean;
  items: SentMessageDto[];
  page: number;
};

export type SendMessageResponse = {
  ok: boolean;
  message_id: number;
};

export type PreviewResponse = {
  ok: boolean;
  preview_base64: string;
};
