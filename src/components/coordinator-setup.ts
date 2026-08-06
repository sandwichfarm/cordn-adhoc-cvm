export interface CoordinatorSetupSubmission {
  name: string;
  persistence: "persistent" | "ephemeral";
  passphrase: string;
  confirmPassphrase: string;
  relays: string[];
  announce: boolean;
  autostart: boolean;
}
