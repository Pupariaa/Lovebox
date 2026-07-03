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

const CLAIM_RETRY_COUNT = 24;
const CLAIM_RETRY_DELAY_MS = 3000;
const CLAIM_INITIAL_DELAY_MS = 2000;

const ble = new BleProvisioner();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function userMessage(error: unknown): string {
  if (error instanceof ApiException) return error.message ?? "Erreur reseau";
  if (error instanceof Error) return mapApiError(error.message ?? "Erreur reseau");
  return "Erreur reseau";
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
  return userMessage(error);
}

type AppState = {
  isLoggedIn: boolean;
  loading: boolean;
  snackbarMessage: string | null;

  devices: DeviceDto[];
  myDevice: DeviceDto | null;
  selectedDeviceId: number;
  ownedDevices: OwnedDeviceDto[];
  ownedDevice: OwnedDeviceDto | null;
  linkedTargets: LinkedTargetDto[];
  linkedTarget: LinkedTargetDto | null;
  selectedTarget: LinkedTargetDto | null;
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

  showSnackbar: (message: string) => void;
  clearSnackbar: () => void;
  bootstrap: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  afterExternalLogin: () => Promise<void>;
  logout: () => Promise<void>;
  refreshState: () => Promise<void>;
  selectDevice: (deviceId: number) => void;
  selectTarget: (target: LinkedTargetDto) => void;
  scanBle: () => Promise<void>;
  resetBleProvision: () => void;
  provisionBle: (
    address: string,
    deviceName: string,
    ssid: string,
    password: string,
  ) => Promise<boolean>;
  retryClaimAfterProvision: () => Promise<boolean>;
  generatePairingCode: () => Promise<void>;
  markPairingCodeCopied: () => void;
  acceptPairingCode: (code: string) => Promise<void>;
  unlinkTarget: (pairingId: number) => Promise<void>;
  unclaimDevice: (deviceId: number) => Promise<boolean>;
  sendMessage: () => Promise<boolean>;
  loadHistory: () => Promise<void>;
  updateDeviceSettings: (displayName: string, regionOverride: string) => Promise<void>;
  loadUserProfile: () => Promise<void>;
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
    userProfile,
  });
}

export const useAppStore = create<AppState>((set, get) => {
  const clearSession = () => {
    void api.clearLocalSession();
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
      userProfile: null,
      pairingCode: null,
    });
  };

  const claimDeviceWhenOnline = async (uuid: string, serialNumber: string) => {
    if (uuid.length !== 128 || !/^\d+$/.test(uuid)) {
      throw new ApiException("Identifiant de boîte invalide", 400);
    }
    if (!serialNumber.trim()) {
      throw new ApiException("Numero de serie manquant", 400);
    }
    await delay(CLAIM_INITIAL_DELAY_MS);
    for (let attempt = 0; attempt < CLAIM_RETRY_COUNT; attempt++) {
      set({ bleProvisionPhase: BleProvisionPhase.LinkingAccount });
      try {
        await api.claimDevice(uuid, serialNumber);
        return;
      } catch (error) {
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
    loading: false,
    snackbarMessage: null,
    devices: [],
    myDevice: null,
    selectedDeviceId: 0,
    ownedDevices: [],
    ownedDevice: null,
    linkedTargets: [],
    linkedTarget: null,
    selectedTarget: null,
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

    showSnackbar: (message) => set({ snackbarMessage: message }),
    clearSnackbar: () => set({ snackbarMessage: null }),

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
        if (error instanceof ApiException && error.status === 401) clearSession();
        return false;
      }
    },

    login: async (email, password) => {
      set({ loading: true });
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
        set({ loading: false });
      }
    },

    register: async (email, password) => {
      set({ loading: true });
      try {
        await api.register(email, password);
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
        set({ loading: false });
      }
    },

    afterExternalLogin: async () => {
      set({ loading: true, isLoggedIn: true });
      try {
        await loadRemoteState(set, get);
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        set({ loading: false });
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

    refreshState: async () => {
      set({ loading: true });
      try {
        await loadRemoteState(set, get);
      } catch (error) {
        if (error instanceof ApiException && error.status === 401) clearSession();
        else set({ snackbarMessage: userMessage(error) });
      } finally {
        set({ loading: false });
      }
    },

    selectDevice: (deviceId) => {
      set({
        selectedDeviceId: deviceId,
        myDevice: get().devices.find((d) => d.id === deviceId) ?? get().myDevice,
      });
    },

    selectTarget: (target) => set({ selectedTarget: target }),

    scanBle: async () => {
      set({ loading: true });
      try {
        const devices = await ble.scan();
        set({ bleDevices: devices });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        set({ loading: false });
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
      set({
        loading: true,
        bleProvisionError: null,
        bleWifiProvisioned: false,
        bleProvisionDeviceName: deviceName,
        bleProvisionPhase: BleProvisionPhase.Connecting,
      });

      let identity: BleBoxIdentity | null = null;
      try {
        await ble.connect(address, deviceName);
        identity = ble.boxIdentity();
      } catch (error) {
        set({
          bleProvisionPhase: BleProvisionPhase.Failed,
          bleProvisionError: bleConnectError(error),
          loading: false,
        });
        await ble.disconnect().catch(() => undefined);
        return false;
      }

      const resolvedName = (identity?.deviceName ?? "").trim() || deviceName.trim();
      if (!resolvedName || resolvedName.toLowerCase() === "boiteacoeur") {
        set({
          bleProvisionPhase: BleProvisionPhase.Failed,
          bleProvisionError:
            "Impossible de lire l'identité de la boîte. Reflashe le firmware et réessaie.",
          loading: false,
        });
        await ble.disconnect().catch(() => undefined);
        return false;
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
        set({
          bleProvisionPhase: BleProvisionPhase.Failed,
          bleProvisionError: userMessage(error),
          loading: false,
        });
        await ble.disconnect().catch(() => undefined);
        return false;
      }

      set({ bleProvisionPhase: BleProvisionPhase.WaitingForBox });
      let wifiOk = false;
      try {
        wifiOk = await ble.awaitWifiResult();
      } catch (error) {
        set({
          bleProvisionPhase: BleProvisionPhase.Failed,
          bleProvisionError: userMessage(error),
          loading: false,
        });
        return false;
      }
      if (!wifiOk) {
        set({
          bleProvisionPhase: BleProvisionPhase.Failed,
          bleProvisionError:
            "La boîte n'a pas pu se connecter au WiFi. Vérifie que le réseau est en 2,4 GHz et que le mot de passe est correct.",
          loading: false,
        });
        await ble.disconnect().catch(() => undefined);
        return false;
      }

      set({ bleWifiProvisioned: true, bleProvisionPhase: BleProvisionPhase.LinkingAccount });
      try {
        await claimDeviceWhenOnline(
          get().bleProvisionUuid ?? "",
          get().bleProvisionSerialNumber ?? "",
        );
        await loadRemoteState(set, get);
        set({ bleProvisionPhase: BleProvisionPhase.Success, loading: false });
        await ble.disconnect().catch(() => undefined);
        return true;
      } catch (error) {
        set({
          bleProvisionPhase: BleProvisionPhase.Failed,
          bleProvisionError: userMessage(error),
          loading: false,
        });
        await ble.disconnect().catch(() => undefined);
        return false;
      }
    },

    retryClaimAfterProvision: async () => {
      const uuid = get().bleProvisionUuid?.trim() ?? "";
      const serial = get().bleProvisionSerialNumber?.trim() ?? "";
      if (!uuid || !serial) {
        set({ bleProvisionError: "Identité de boîte incomplète" });
        return false;
      }
      set({ loading: true, bleProvisionError: null, bleProvisionPhase: BleProvisionPhase.LinkingAccount });
      try {
        await claimDeviceWhenOnline(uuid, serial);
        await loadRemoteState(set, get);
        set({ bleProvisionPhase: BleProvisionPhase.Success, loading: false });
        return true;
      } catch (error) {
        set({
          bleProvisionPhase: BleProvisionPhase.Failed,
          bleProvisionError: userMessage(error),
          loading: false,
        });
        return false;
      }
    },

    generatePairingCode: async () => {
      set({ loading: true, pairingCodeCopied: false });
      try {
        const deviceId = get().devices.length > 1 ? get().selectedDeviceId || null : null;
        const response = await api.generatePairingCode(deviceId);
        set({ pairingCode: response.code });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        set({ loading: false });
      }
    },

    markPairingCodeCopied: () => set({ pairingCodeCopied: true, snackbarMessage: "Code copié" }),

    acceptPairingCode: async (code) => {
      set({ loading: true });
      try {
        const deviceId = get().devices.length > 1 ? get().selectedDeviceId || null : null;
        await api.acceptPairingCode(code, deviceId);
        await loadRemoteState(set, get);
        set({ snackbarMessage: "Personne liée" });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        set({ loading: false });
      }
    },

    unlinkTarget: async (pairingId) => {
      set({ loading: true });
      try {
        await api.unlinkPairing(pairingId);
        await loadRemoteState(set, get);
        set({ snackbarMessage: "Personne retirée" });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        set({ loading: false });
      }
    },

    unclaimDevice: async (deviceId) => {
      set({ loading: true });
      try {
        await api.unclaimDevice(deviceId);
        await loadRemoteState(set, get);
        set({ snackbarMessage: "Boîte dissociée" });
        return true;
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
        return false;
      } finally {
        set({ loading: false });
      }
    },

    sendMessage: async () => {
      const target = get().selectedTarget ?? get().linkedTarget;
      if (!target) {
        set({ snackbarMessage: "Aucune boîte liée pour recevoir ton message" });
        return false;
      }
      set({ loading: true });
      try {
        const bacm = await buildFromScene(get().composerScene);
        const scheduled = get().scheduledSendAt?.trim() || null;
        const ephemeral = get().composerEphemeral;
        await api.sendMessage(target.device_id, bacm, scheduled, ephemeral);
        set({ snackbarMessage: ephemeral ? "Message éphémère envoyé" : "Message envoyé sur sa boîte" });
        return true;
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
        return false;
      } finally {
        set({ loading: false });
      }
    },

    loadHistory: async () => {
      set({ loading: true });
      try {
        const response = await api.listSentMessages();
        set({ history: response.items });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        set({ loading: false });
      }
    },

    updateDeviceSettings: async (displayName, regionOverride) => {
      const deviceId = get().selectedDeviceId || get().myDevice?.id;
      if (!deviceId) return;
      set({ loading: true });
      try {
        const response = await api.updateDevice(
          deviceId,
          displayName.trim(),
          regionOverride.trim(),
        );
        const updated = response.device;
        if (updated) {
          set({
            devices: get().devices.map((d) => (d.id === updated.id ? updated : d)),
            myDevice: get().myDevice?.id === updated.id ? updated : get().myDevice,
          });
        }
        void pushDeviceConfigViaBle(get, displayName.trim(), regionOverride.trim());
        set({ snackbarMessage: "Réglages enregistrés" });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      } finally {
        set({ loading: false });
      }
    },

    loadUserProfile: async () => {
      try {
        const profile = await api.getUserProfile();
        set({ userProfile: profile });
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
      }
    },

    updateUserProfile: async (patch) => {
      set({ loading: true });
      try {
        const profile = await api.updateUserProfile(patch);
        set({ userProfile: profile, snackbarMessage: "Profil mis à jour" });
        return true;
      } catch (e) {
        set({ snackbarMessage: userMessage(e) });
        return false;
      } finally {
        set({ loading: false });
      }
    },

    setComposerScene: (scene) => set({ composerScene: scene }),
    setScheduledSendAt: (value) => set({ scheduledSendAt: value }),
    setComposerEphemeral: (value) => set({ composerEphemeral: value }),
  };
});

async function pushDeviceConfigViaBle(
  get: () => AppState,
  displayName: string,
  region: string,
): Promise<void> {
  const locale = get().userProfile?.locale?.trim() || "fr";
  const deviceName = get().myDevice?.device_name ?? get().bleProvisionDeviceName;
  if (!deviceName) return;
  try {
    const candidates = await ble.scan(6000);
    const match = candidates.find(
      (c) =>
        c.name.toLowerCase() === deviceName.toLowerCase() ||
        c.name.toLowerCase() === displayName.toLowerCase(),
    );
    if (!match) return;
    await ble.connect(match.address, match.name);
    await ble.sendDeviceConfig(displayName, locale, region);
    await ble.disconnect();
  } catch {
    // best effort BLE push
  }
}
