import { create } from "zustand";
import * as api from "@/data/api/ApiClient";
import { ApiException, mapApiError } from "@/data/api/errors";
import {
  BleProvisioner,
  type BleBoxIdentity,
  type BleDeviceItem,
} from "@/data/ble/BleProvisioner";
import type {
  DeviceDto,
  LinkedTargetDto,
  OwnedDeviceDto,
  ReceivedMessageDto,
  SentMessageDto,
  UserProfileDto,
} from "@/data/api/models";
import { buildFromScene } from "@/domain/bacm/bacmPack";
import { createDefaultScene, type MessageScene } from "@/domain/bacm/scene";

export enum BleProvisionPhase {
  Idle = "idle",
  Connecting = "connecting",
  SendingWifi = "sendingWifi",
  WaitingForBox = "waitingForBox",
  LinkingAccount = "linkingAccount",
  Success = "success",
  Failed = "failed",
}

export type LoadingOp =
  | "auth"
  | "refresh"
  | "scan"
  | "provision"
  | "claim"
  | "pairing"
  | "saveSettings"
  | "deviceAction"
  | "send"
  | "history"
  | "received"
  | "profile";

const PROVISION_CANCELLED = "provisioning cancelled";

const CLAIM_RETRY_COUNT = 24;
const CLAIM_RETRY_DELAY_MS = 3000;
const CLAIM_INITIAL_DELAY_MS = 2000;

// Tab screens refetch on every focus. This throttles those focus-driven reads so
// quickly switching tabs does not fire redundant network calls; manual pull-to-refresh
// passes force=true to bypass it.
const FOCUS_REFETCH_TTL_MS = 20000;
let lastRefreshStateAt = 0;
let lastHistoryAt = 0;
let lastReceivedAt = 0;
let lastProfileAt = 0;

const ble = new BleProvisioner();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function userMessage(error: unknown): string {
  if (error instanceof ApiException) return mapApiError(error.message ?? "Erreur réseau.");
  if (error instanceof Error) return mapApiError(error.message ?? "Erreur réseau.");
  return "Erreur réseau.";
}

function isClaimRetryable(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : "").toLowerCase();
  if (msg.includes("deja") || msg.includes("already")) return false;
  if (error instanceof ApiException && error.status === 400) {
    if (msg.includes("enregistr")) return true;
    if (msg.includes("device not found")) return true;
  }
  return msg.includes("device not found") || msg.includes("pas encore enregistr");
}

function bleConnectError(error: unknown): string {
  const raw = (error instanceof Error ? error.message : "").toLowerCase();
  if (raw.includes("device not found") || raw.includes("scan again"))
    return "Boîte Bluetooth introuvable. Relance une recherche et reste proche de la boîte.";
  if (raw.includes("not connected") || raw.includes("disconnect"))
    return "Connexion Bluetooth perdue. Vérifie que la boîte est en mode configuration.";
  if (raw.includes("bluetooth desactiv"))
    return "Bluetooth désactivé.";
  return userMessage(error);
}

type AppState = {
  isLoggedIn: boolean;
  loadingOps: Partial<Record<LoadingOp, boolean>>;
  isOnline: boolean;
  bleLiveSettingsError: string | null;
  snackbarMessage: string | null;

  devices: DeviceDto[];
  myDevice: DeviceDto | null;
  selectedDeviceId: number;
  ownedDevices: OwnedDeviceDto[];
  ownedDevice: OwnedDeviceDto | null;
  linkedTargets: LinkedTargetDto[];
  linkedTarget: LinkedTargetDto | null;
  selectedTarget: LinkedTargetDto | null;
  selectedTargetIds: number[];
  userProfile: UserProfileDto | null;

  pairingCode: string | null;
  pairingCodeCopied: boolean;

  bleDevices: BleDeviceItem[];
  bleProvisionPhase: BleProvisionPhase;
  bleProvisionError: string | null;
  bleProvisionDeviceName: string | null;
  bleProvisionSerialNumber: string | null;
  bleProvisionUuid: string | null;
  bleWifiProvisioned: boolean;

  composerScene: MessageScene;
  scheduledSendAt: string | null;
  composerEphemeral: boolean;
  history: SentMessageDto[];
  received: ReceivedMessageDto[];

  showSnackbar: (message: string) => void;
  clearSnackbar: () => void;
  setNetworkOnline: (online: boolean) => void;
  bootstrap: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, firstName: string) => Promise<boolean>;
  afterExternalLogin: () => Promise<void>;
  logout: () => Promise<void>;
  refreshState: (force?: boolean) => Promise<void>;
  selectDevice: (deviceId: number) => void;
  selectTarget: (target: LinkedTargetDto) => void;
  toggleTargetId: (deviceId: number) => void;
  setSelectedTargetIds: (ids: number[]) => void;
  scanBle: () => Promise<void>;
  resetBleProvision: () => void;
  provisionBle: (
    address: string,
    deviceName: string,
    ssid: string,
    password: string,
  ) => Promise<boolean>;
  cancelBleProvision: () => Promise<void>;
  retryClaimAfterProvision: () => Promise<boolean>;
  generatePairingCode: () => Promise<void>;
  markPairingCodeCopied: () => void;
  acceptPairingCode: (code: string) => Promise<void>;
  unlinkTarget: (pairingId: number) => Promise<void>;
  setTargetAlias: (pairingId: number, alias: string | null) => Promise<boolean>;
  unclaimDevice: (deviceId: number) => Promise<boolean>;
  resetAndDeleteDevice: (deviceId: number) => Promise<boolean>;
  sendMessage: () => Promise<boolean>;
  loadHistory: (force?: boolean) => Promise<void>;
  loadReceived: (force?: boolean) => Promise<void>;
  updateDeviceSettings: (deviceId: number, displayName: string, regionOverride: string) => Promise<void>;
  updateBoxSettings: (
    deviceId: number,
    settings: {
      backlightLevel: number;
      sleepTimeoutSec: number;
      displaySleepEnabled: boolean;
    },
  ) => Promise<void>;
  saveDeviceSettings: (
    deviceId: number,
    patch: {
      displayName: string;
      regionOverride: string;
      locale: string;
      backlightLevel: number;
      sleepTimeoutSec: number;
      displaySleepEnabled: boolean;
    },
  ) => Promise<void>;
  pushBoxSettingsLive: (
    deviceId: number,
    settings: {
      displayName: string;
      regionOverride: string;
      locale: string;
      backlightLevel: number;
      sleepTimeoutSec: number;
      displaySleepEnabled: boolean;
    },
  ) => Promise<void>;
  loadUserProfile: (force?: boolean) => Promise<void>;
  updateUserProfile: (patch: {
    firstName?: string | null;
    lastName?: string | null;
    locale?: string | null;
    password?: string | null;
  }) => Promise<boolean>;
  setComposerScene: (scene: MessageScene) => void;
  setScheduledSendAt: (value: string | null) => void;
  setComposerEphemeral: (value: boolean) => void;
};

async function loadRemoteState(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
): Promise<void> {
  const deviceResponse = await api.getMyDevice();
  const devices = deviceResponse.devices;
  let selectedDeviceId = get().selectedDeviceId;
  let myDevice = deviceResponse.device ?? devices[0] ?? null;
  if (selectedDeviceId === 0 || !devices.some((d) => d.id === selectedDeviceId)) {
    selectedDeviceId = myDevice?.id ?? 0;
  }
  myDevice = devices.find((d) => d.id === selectedDeviceId) ?? devices[0] ?? null;

  const pairing = await api.getPairingState();
  const linkedTargets = pairing.linked_targets;
  const linkedTarget = pairing.linked_target ?? linkedTargets[0] ?? null;
  const prevTarget = get().selectedTarget;
  let selectedTarget: LinkedTargetDto | null;
  if (!prevTarget || !linkedTargets.some((t) => t.device_id === prevTarget.device_id)) {
    selectedTarget = linkedTarget;
  } else {
    selectedTarget = linkedTargets.find((t) => t.device_id === prevTarget.device_id) ?? null;
  }

  const validIds = new Set(linkedTargets.map((t) => t.device_id));
  let selectedTargetIds = get().selectedTargetIds.filter((id) => validIds.has(id));
  if (selectedTargetIds.length === 0 && selectedTarget) {
    selectedTargetIds = [selectedTarget.device_id];
  }

  let userProfile: UserProfileDto | null = null;
  try {
    userProfile = await api.getUserProfile();
  } catch {
    userProfile = get().userProfile;
  }

  set({
    devices,
    myDevice,
    selectedDeviceId,
    ownedDevices: pairing.owned_devices,
    ownedDevice: pairing.owned_device ?? pairing.owned_devices[0] ?? null,
    linkedTargets,
    linkedTarget,
    selectedTarget,
    selectedTargetIds,
    userProfile,
  });
}

export const useAppStore = create<AppState>((set, get) => {
  let provisionCancelRequested = false;

  const setOp = (op: LoadingOp, value: boolean) => {
    set({ loadingOps: { ...get().loadingOps, [op]: value } });
  };

  const isProvisionCancelled = (error: unknown): boolean => {
    if (provisionCancelRequested) return true;
    return error instanceof Error && error.message === PROVISION_CANCELLED;
  };

  const clearSession = () => {
    void api.clearLocalSession();
    lastRefreshStateAt = 0;
    lastHistoryAt = 0;
    lastReceivedAt = 0;
    lastProfileAt = 0;
    set({
      isLoggedIn: false,
      devices: [],
      myDevice: null,
      selectedDeviceId: 0,
      ownedDevices: [],
      ownedDevice: null,
      linkedTargets: [],
      linkedTarget: null,
      selectedTarget: null,
      selectedTargetIds: [],
      userProfile: null,
      pairingCode: null,
    });
  };

  const claimDeviceWhenOnline = async (uuid: string, serialNumber: string) => {
    if (uuid.length !== 128 || !/^\d+$/.test(uuid)) {
      throw new ApiException("Identifiant de boîte invalide.", 400);
    }
    if (!serialNumber.trim()) {
      throw new ApiException("Numéro de série manquant.", 400);
    }
    await delay(CLAIM_INITIAL_DELAY_MS);
    for (let attempt = 0; attempt < CLAIM_RETRY_COUNT; attempt++) {
      if (provisionCancelRequested) throw new Error(PROVISION_CANCELLED);
      set({ bleProvisionPhase: BleProvisionPhase.LinkingAccount });
      try {
        await api.claimDevice(uuid, serialNumber);
        return;
      } catch (error) {
        if (provisionCancelRequested) throw new Error(PROVISION_CANCELLED);
        if (isClaimRetryable(error) && attempt < CLAIM_RETRY_COUNT - 1) {
          await delay(CLAIM_RETRY_DELAY_MS);
        } else {
          throw error;
        }
      }
    }
  };

  return {
    isLoggedIn: false,
    loadingOps: {},
    isOnline: true,
    bleLiveSettingsError: null,
    snackbarMessage: null,
    devices: [],
    myDevice: null,
    selectedDeviceId: 0,
    ownedDevices: [],
    ownedDevice: null,
    linkedTargets: [],
    linkedTarget: null,
    selectedTarget: null,
    selectedTargetIds: [],
    userProfile: null,
    pairingCode: null,
    pairingCodeCopied: false,
    bleDevices: [],
    bleProvisionPhase: BleProvisionPhase.Idle,
    bleProvisionError: null,
    bleProvisionDeviceName: null,
    bleProvisionSerialNumber: null,
    bleProvisionUuid: null,
    bleWifiProvisioned: false,
    composerScene: createDefaultScene(),
    scheduledSendAt: null,
    composerEphemeral: false,
    history: [],
    received: [],

    showSnackbar: (message) => set({ snackbarMessage: message }),
    clearSnackbar: () => set({ snackbarMessage: null }),
    setNetworkOnline: (online) => {
      if (get().isOnline !== online) set({ isOnline: online });
    },

    bootstrap: async () => {
      const { tokenStorage } = await import("@/data/storage/tokenStorage");
      await tokenStorage.load();
      if (!tokenStorage.getAccessToken()) {
        set({ isLoggedIn: false });
        return false;
      }
      try {
        await loadRemoteState(set, get);
        set({ isLoggedIn: true });
        return true;
      } catch (error) {
        if (error instanceof ApiException && error.status === 401) {
          clearSession();
          return false;
        }
        console.warn("bootstrap failed, keeping session for retry", error);
        set({ isLoggedIn: true, snackbarMessage: userMessage(error) });
        return true;
      }
    },

    login: async (email, password) => {
      setOp("auth", true);
      try {
        await api.login(email, password);
        set({ isLoggedIn: true });
        try {
          await loadRemoteState(set, get);
        } catch (e) {
          set({ snackbarMessage: userMessage(e) });
        }
        return true;
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
        return false;
      } finally {
        setOp("auth", false);
      }
    },

    register: async (email, password, firstName) => {
      setOp("auth", true);
      try {
        await api.register(email, password, firstName);
        set({ isLoggedIn: true });
        try {
          await loadRemoteState(set, get);
        } catch (e) {
          set({ snackbarMessage: userMessage(e) });
        }
        return true;
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
        return false;
      } finally {
        setOp("auth", false);
      }
    },

    afterExternalLogin: async () => {
      setOp("auth", true);
      set({ isLoggedIn: true });
      try {
        await loadRemoteState(set, get);
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        setOp("auth", false);
      }
    },

    logout: async () => {
      try {
        await api.logout();
      } catch {
        // best effort
      }
      clearSession();
    },

    refreshState: async (force = false) => {
      if (!force && Date.now() - lastRefreshStateAt < FOCUS_REFETCH_TTL_MS) return;
      lastRefreshStateAt = Date.now();
      setOp("refresh", true);
      try {
        await loadRemoteState(set, get);
      } catch (error) {
        if (error instanceof ApiException && error.status === 401) clearSession();
        else set({ snackbarMessage: userMessage(error) });
      } finally {
        setOp("refresh", false);
      }
    },

    selectDevice: (deviceId) => {
      set({
        selectedDeviceId: deviceId,
        myDevice: get().devices.find((d) => d.id === deviceId) ?? get().myDevice,
      });
    },

    selectTarget: (target) =>
      set({ selectedTarget: target, selectedTargetIds: [target.device_id] }),

    toggleTargetId: (deviceId) => {
      const current = get().selectedTargetIds;
      const exists = current.includes(deviceId);
      let next = exists ? current.filter((id) => id !== deviceId) : [...current, deviceId];
      if (next.length === 0) next = [deviceId];
      const targets = get().linkedTargets;
      const primary = targets.find((t) => t.device_id === next[0]) ?? get().selectedTarget;
      set({ selectedTargetIds: next, selectedTarget: primary });
    },

    setSelectedTargetIds: (ids) => {
      const targets = get().linkedTargets;
      const primary = ids.length ? targets.find((t) => t.device_id === ids[0]) ?? null : null;
      set({ selectedTargetIds: ids, selectedTarget: primary ?? get().selectedTarget });
    },

    scanBle: async () => {
      provisionCancelRequested = false;
      ble.resetAbort();
      setOp("scan", true);
      try {
        const devices = await ble.scan();
        set({ bleDevices: devices });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        setOp("scan", false);
      }
    },

    resetBleProvision: () =>
      set({
        bleProvisionPhase: BleProvisionPhase.Idle,
        bleProvisionError: null,
        bleWifiProvisioned: false,
        bleProvisionSerialNumber: null,
        bleProvisionUuid: null,
      }),

    provisionBle: async (address, deviceName, ssid, password) => {
      provisionCancelRequested = false;
      ble.resetAbort();
      setOp("provision", true);
      set({
        bleProvisionError: null,
        bleWifiProvisioned: false,
        bleProvisionDeviceName: deviceName,
        bleProvisionPhase: BleProvisionPhase.Connecting,
      });

      const failProvision = async (message: string): Promise<boolean> => {
        if (isProvisionCancelled(null)) {
          setOp("provision", false);
          return false;
        }
        set({ bleProvisionPhase: BleProvisionPhase.Failed, bleProvisionError: message });
        setOp("provision", false);
        await ble.disconnect().catch(() => undefined);
        return false;
      };

      let identity: BleBoxIdentity | null = null;
      try {
        await ble.connect(address, deviceName);
        identity = ble.boxIdentity();
      } catch (error) {
        if (isProvisionCancelled(error)) {
          setOp("provision", false);
          return false;
        }
        return failProvision(bleConnectError(error));
      }

      const resolvedName = (identity?.deviceName ?? "").trim() || deviceName.trim();
      if (!resolvedName || resolvedName.toLowerCase() === "boiteacoeur") {
        return failProvision(
          "Impossible de lire l'identité de la boîte. Reflashe le firmware et réessaie.",
        );
      }
      set({
        bleProvisionDeviceName: resolvedName,
        bleProvisionSerialNumber: identity?.serialNumber?.trim() || null,
        bleProvisionUuid: identity?.uuid?.trim() || null,
        bleProvisionPhase: BleProvisionPhase.SendingWifi,
      });

      try {
        await ble.sendWifiCredentials(ssid, password);
      } catch (error) {
        if (isProvisionCancelled(error)) {
          setOp("provision", false);
          return false;
        }
        return failProvision(userMessage(error));
      }

      set({ bleProvisionPhase: BleProvisionPhase.WaitingForBox });
      let wifiOk = false;
      try {
        wifiOk = await ble.awaitWifiResult();
      } catch (error) {
        if (isProvisionCancelled(error)) {
          setOp("provision", false);
          return false;
        }
        return failProvision(userMessage(error));
      }
      if (!wifiOk) {
        return failProvision(
          "La boîte n'a pas pu se connecter au WiFi. Vérifie que le réseau est en 2,4 GHz et que le mot de passe est correct.",
        );
      }

      set({ bleWifiProvisioned: true, bleProvisionPhase: BleProvisionPhase.LinkingAccount });
      try {
        await claimDeviceWhenOnline(
          get().bleProvisionUuid ?? "",
          get().bleProvisionSerialNumber ?? "",
        );
        await loadRemoteState(set, get);
        set({ bleProvisionPhase: BleProvisionPhase.Success });
        setOp("provision", false);
        await ble.disconnect().catch(() => undefined);
        return true;
      } catch (error) {
        if (isProvisionCancelled(error)) {
          setOp("provision", false);
          return false;
        }
        return failProvision(userMessage(error));
      }
    },

    cancelBleProvision: async () => {
      provisionCancelRequested = true;
      console.log("ble provisioning cancelled by user");
      await ble.cancel().catch(() => undefined);
      setOp("provision", false);
      setOp("claim", false);
      set({
        bleProvisionPhase: BleProvisionPhase.Idle,
        bleProvisionError: null,
        bleWifiProvisioned: false,
      });
    },

    retryClaimAfterProvision: async () => {
      const uuid = get().bleProvisionUuid?.trim() ?? "";
      const serial = get().bleProvisionSerialNumber?.trim() ?? "";
      if (!uuid || !serial) {
        set({ bleProvisionError: "Identité de boîte incomplète." });
        return false;
      }
      provisionCancelRequested = false;
      setOp("claim", true);
      set({ bleProvisionError: null, bleProvisionPhase: BleProvisionPhase.LinkingAccount });
      try {
        await claimDeviceWhenOnline(uuid, serial);
        await loadRemoteState(set, get);
        set({ bleProvisionPhase: BleProvisionPhase.Success });
        setOp("claim", false);
        return true;
      } catch (error) {
        setOp("claim", false);
        if (isProvisionCancelled(error)) return false;
        set({
          bleProvisionPhase: BleProvisionPhase.Failed,
          bleProvisionError: userMessage(error),
        });
        return false;
      }
    },

    generatePairingCode: async () => {
      setOp("pairing", true);
      set({ pairingCodeCopied: false });
      try {
        const deviceId = get().devices.length > 1 ? get().selectedDeviceId || null : null;
        const response = await api.generatePairingCode(deviceId);
        set({ pairingCode: response.code });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        setOp("pairing", false);
      }
    },

    markPairingCodeCopied: () => set({ pairingCodeCopied: true, snackbarMessage: "Code copié." }),

    acceptPairingCode: async (code) => {
      setOp("pairing", true);
      try {
        const deviceId = get().devices.length > 1 ? get().selectedDeviceId || null : null;
        await api.acceptPairingCode(code, deviceId);
        await loadRemoteState(set, get);
        set({ snackbarMessage: "Personne liée." });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        setOp("pairing", false);
      }
    },

    unlinkTarget: async (pairingId) => {
      setOp("pairing", true);
      try {
        await api.unlinkPairing(pairingId);
        await loadRemoteState(set, get);
        set({ snackbarMessage: "Personne retirée." });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        setOp("pairing", false);
      }
    },

    setTargetAlias: async (pairingId, alias) => {
      setOp("pairing", true);
      try {
        await api.setPairingAlias(pairingId, alias);
        await loadRemoteState(set, get);
        set({ snackbarMessage: "Nom mis à jour." });
        return true;
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
        return false;
      } finally {
        setOp("pairing", false);
      }
    },

    unclaimDevice: async (deviceId) => {
      setOp("deviceAction", true);
      try {
        await api.unclaimDevice(deviceId);
        await loadRemoteState(set, get);
        set({ snackbarMessage: "Boîte dissociée." });
        return true;
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
        return false;
      } finally {
        setOp("deviceAction", false);
      }
    },

    resetAndDeleteDevice: async (deviceId) => {
      setOp("deviceAction", true);
      try {
        await api.deleteDevice(deviceId);
        await loadRemoteState(set, get);
        set({ snackbarMessage: "Boîte réinitialisée et supprimée." });
        return true;
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
        return false;
      } finally {
        setOp("deviceAction", false);
      }
    },

    sendMessage: async () => {
      const targets = get().linkedTargets;
      const ids = get().selectedTargetIds;
      let deviceIds = ids.filter((id) => targets.some((t) => t.device_id === id));
      if (deviceIds.length === 0) {
        const fallback = get().selectedTarget ?? get().linkedTarget;
        if (fallback) deviceIds = [fallback.device_id];
      }
      if (deviceIds.length === 0) {
        set({ snackbarMessage: "Aucune boîte liée pour recevoir ton message." });
        return false;
      }
      setOp("send", true);
      try {
        const bacm = await buildFromScene(get().composerScene);
        const scheduled = get().scheduledSendAt?.trim() || null;
        const ephemeral = get().composerEphemeral;
        const results = await Promise.allSettled(
          deviceIds.map((id) => api.sendMessage(id, bacm, scheduled, ephemeral)),
        );
        const sent = results.filter((r) => r.status === "fulfilled").length;
        const failed = results.length - sent;
        if (sent === 0) {
          const firstError = results.find((r) => r.status === "rejected") as
            | PromiseRejectedResult
            | undefined;
          set({ snackbarMessage: firstError ? userMessage(firstError.reason) : "Échec de l'envoi." });
          return false;
        }
        if (deviceIds.length > 1) {
          set({
            snackbarMessage:
              failed === 0
                ? `Message envoyé à ${sent} boîtes.`
                : `Message envoyé à ${sent}/${results.length} boîtes.`,
          });
        } else {
          set({
            snackbarMessage: ephemeral ? "Message éphémère envoyé." : "Message envoyé sur sa boîte.",
          });
        }
        return true;
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
        return false;
      } finally {
        setOp("send", false);
      }
    },

    loadHistory: async (force = false) => {
      if (!force && Date.now() - lastHistoryAt < FOCUS_REFETCH_TTL_MS) return;
      lastHistoryAt = Date.now();
      setOp("history", true);
      try {
        const response = await api.listSentMessages();
        set({ history: response.items });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        setOp("history", false);
      }
    },

    loadReceived: async (force = false) => {
      if (!force && Date.now() - lastReceivedAt < FOCUS_REFETCH_TTL_MS) return;
      lastReceivedAt = Date.now();
      setOp("received", true);
      try {
        const response = await api.listReceivedMessages();
        set({ received: response.items });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        setOp("received", false);
      }
    },

    updateDeviceSettings: async (deviceId, displayName, regionOverride) => {
      if (!deviceId) return;
      setOp("saveSettings", true);
      try {
        const response = await api.updateDevice(deviceId, {
          displayName: displayName.trim(),
          regionOverride: regionOverride.trim(),
        });
        const updated = response.device;
        if (updated) {
          set({
            devices: get().devices.map((d) => (d.id === updated.id ? updated : d)),
            myDevice: get().myDevice?.id === updated.id ? updated : get().myDevice,
          });
        }
        const device = get().devices.find((d) => d.id === deviceId);
        void pushDeviceConfigViaBle(
          get,
          device?.device_name,
          device?.uuid ?? null,
          displayName.trim(),
          regionOverride.trim(),
          device?.locale ?? get().userProfile?.locale ?? "fr",
        );
        set({ snackbarMessage: "Réglages enregistrés." });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        setOp("saveSettings", false);
      }
    },

    updateBoxSettings: async (deviceId, settings) => {
      if (!deviceId) return;
      setOp("saveSettings", true);
      try {
        const response = await api.updateDevice(deviceId, {
          backlightLevel: settings.backlightLevel,
          sleepTimeoutSec: settings.sleepTimeoutSec,
          displaySleepEnabled: settings.displaySleepEnabled,
        });
        const updated = response.device;
        if (updated) {
          set({
            devices: get().devices.map((d) => (d.id === updated.id ? updated : d)),
            myDevice: get().myDevice?.id === updated.id ? updated : get().myDevice,
          });
        }
        const device = get().devices.find((d) => d.id === deviceId) ?? get().myDevice;
        void pushBoxSettingsViaBle(get, device?.device_name, device?.uuid ?? null, {
          displayName: device?.display_name ?? device?.device_name ?? "",
          region: device?.region_override ?? device?.region ?? "",
          locale: device?.locale ?? get().userProfile?.locale ?? "fr",
          ...settings,
        });
        set({ snackbarMessage: "Réglages enregistrés." });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        setOp("saveSettings", false);
      }
    },

    saveDeviceSettings: async (deviceId, patch) => {
      if (!deviceId) return;
      setOp("saveSettings", true);
      try {
        const response = await api.updateDevice(deviceId, {
          displayName: patch.displayName.trim(),
          regionOverride: patch.regionOverride.trim(),
          locale: patch.locale.trim() || "fr",
          backlightLevel: patch.backlightLevel,
          sleepTimeoutSec: patch.sleepTimeoutSec,
          displaySleepEnabled: patch.displaySleepEnabled,
        });
        const updated = response.device;
        if (updated) {
          set({
            devices: get().devices.map((d) => (d.id === updated.id ? updated : d)),
            myDevice: get().myDevice?.id === updated.id ? updated : get().myDevice,
            selectedDeviceId: deviceId,
          });
        }
        const device = get().devices.find((d) => d.id === deviceId);
        set({ snackbarMessage: "Réglages enregistrés." });
        void pushBoxSettingsViaBle(get, device?.device_name, device?.uuid ?? null, {
          displayName: patch.displayName.trim(),
          region: patch.regionOverride.trim(),
          locale: patch.locale.trim() || "fr",
          backlightLevel: patch.backlightLevel,
          sleepTimeoutSec: patch.sleepTimeoutSec,
          displaySleepEnabled: patch.displaySleepEnabled,
        });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        setOp("saveSettings", false);
      }
    },

    pushBoxSettingsLive: async (deviceId, settings) => {
      if (!deviceId) return;
      const device = get().devices.find((d) => d.id === deviceId);
      if (!device) return;
      try {
        const pushed = await pushBoxSettingsViaBle(get, device.device_name, device.uuid ?? null, {
          displayName: settings.displayName.trim(),
          region: settings.regionOverride.trim(),
          locale: settings.locale.trim() || "fr",
          backlightLevel: settings.backlightLevel,
          sleepTimeoutSec: settings.sleepTimeoutSec,
          displaySleepEnabled: settings.displaySleepEnabled,
        });
        if (!pushed) {
          console.warn("live box settings push skipped: box not reachable over BLE");
          set({
            bleLiveSettingsError:
              "Réglage non appliqué en direct : la boîte n'est pas à portée Bluetooth.",
          });
        } else if (get().bleLiveSettingsError) {
          set({ bleLiveSettingsError: null });
        }
      } catch (error) {
        console.warn("live box settings push failed", error);
        set({
          bleLiveSettingsError:
            "Réglage non appliqué en direct : la boîte n'est pas à portée Bluetooth.",
        });
      }
    },

    loadUserProfile: async (force = false) => {
      if (!force && Date.now() - lastProfileAt < FOCUS_REFETCH_TTL_MS) return;
      lastProfileAt = Date.now();
      try {
        const profile = await api.getUserProfile();
        set({ userProfile: profile });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      }
    },

    updateUserProfile: async (patch) => {
      setOp("profile", true);
      try {
        const profile = await api.updateUserProfile(patch);
        set({ userProfile: profile, snackbarMessage: "Profil mis à jour." });
        return true;
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
        return false;
      } finally {
        setOp("profile", false);
      }
    },

    setComposerScene: (scene) => set({ composerScene: scene }),
    setScheduledSendAt: (value) => set({ scheduledSendAt: value }),
    setComposerEphemeral: (value) => set({ composerEphemeral: value }),
  };
});

export function useLoading(op: LoadingOp): boolean {
  return useAppStore((s) => s.loadingOps[op] ?? false);
}

async function connectBleForConfig(
  get: () => AppState,
  deviceName?: string | null,
  deviceUuid?: string | null,
  scanTimeoutMs = 5000,
): Promise<boolean> {
  const resolvedName = deviceName ?? get().myDevice?.device_name ?? get().bleProvisionDeviceName;
  if (!resolvedName) return false;
  const { loadStoredBleDevice } = await import("@/data/storage/bleDeviceStorage");
  const stored = await loadStoredBleDevice();
  if (stored && stored.deviceName.toLowerCase() === resolvedName.toLowerCase()) {
    try {
      if (await ble.connectDirect(stored.address, stored.deviceName)) {
        const identity = ble.boxIdentity();
        if (!deviceUuid || !identity?.uuid || identity.uuid === deviceUuid) return true;
        await ble.disconnect();
      }
    } catch {
    }
  }
  const candidates = await ble.scan(scanTimeoutMs);
  const match = candidates.find((c) => c.name.toLowerCase() === resolvedName.toLowerCase());
  if (!match) return false;
  try {
    await ble.connect(match.address, match.name);
    const identity = ble.boxIdentity();
    if (deviceUuid && identity?.uuid && identity.uuid !== deviceUuid) {
      await ble.disconnect();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function pushDeviceConfigViaBle(
  get: () => AppState,
  deviceName: string | null | undefined,
  deviceUuid: string | null | undefined,
  displayName: string,
  region: string,
  locale: string,
): Promise<boolean> {
  try {
    if (!(await connectBleForConfig(get, deviceName, deviceUuid, 4000))) return false;
    await ble.sendDeviceConfig(displayName, locale.trim() || "fr", region);
    await ble.disconnect();
    return true;
  } catch {
    return false;
  }
}

async function pushBoxSettingsViaBle(
  get: () => AppState,
  deviceName: string | null | undefined,
  deviceUuid: string | null | undefined,
  settings: {
    displayName: string;
    region: string;
    locale: string;
    backlightLevel: number;
    sleepTimeoutSec: number;
    displaySleepEnabled: boolean;
  },
): Promise<boolean> {
  try {
    if (!(await connectBleForConfig(get, deviceName, deviceUuid, 4000))) return false;
    await ble.sendBoxSettings(
      settings.displayName,
      settings.locale.trim() || "fr",
      settings.region,
      settings.backlightLevel,
      settings.sleepTimeoutSec,
      settings.displaySleepEnabled,
    );
    await ble.disconnect();
    return true;
  } catch {
    return false;
  }
}
