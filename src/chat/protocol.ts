import {
  base64ToBytes,
  bytesToBase64,
  createApplicationMessage,
  createCommit,
  createGroup,
  defaultCredentialTypes,
  encode,
  generateKeyPackage,
  getCiphersuiteImpl,
  joinGroup,
  keyPackageDecoder,
  keyPackageEncoder,
  mlsMessageDecoder,
  mlsMessageEncoder,
  nobleCryptoProvider,
  privateKeyPackageDecoder,
  privateKeyPackageEncoder,
  processMessage,
  unsafeTestingAuthenticationService,
  wireformats,
  clientStateDecoder,
  clientStateEncoder,
  type ClientState,
  type KeyPackage,
  type PrivateKeyPackage,
  type Welcome,
} from "ts-mls";

const CIPHER_SUITE = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface ChatEnvelope {
  type: "message";
  id: string;
  sender: string;
  name: string;
  content: string;
  createdAt: number;
}

export interface LocalKeyPackage {
  reference: string;
  publicBase64: string;
  privateBase64: string;
}

async function cipherSuite() {
  return getCiphersuiteImpl(CIPHER_SUITE, nobleCryptoProvider);
}

function decodeExact<T>(bytes: Uint8Array, decoder: (value: Uint8Array, offset: number) => [T, number] | undefined, label: string): T {
  const decoded = decoder(bytes, 0);
  if (!decoded || decoded[1] !== bytes.length) throw new Error(`Invalid ${label}`);
  return decoded[0];
}

export function encodeState(state: ClientState): string {
  return bytesToBase64(encode(clientStateEncoder, state));
}

export function decodeState(value: string): ClientState {
  return decodeExact(base64ToBytes(value), clientStateDecoder, "stored chat state");
}

export function groupId(state: ClientState): string {
  return textDecoder.decode(state.groupContext.groupId);
}

export async function createKeyPackage(stablePubkey: string): Promise<{ keyPackage: KeyPackage; privateKeyPackage: PrivateKeyPackage; stored: LocalKeyPackage }> {
  const now = Math.floor(Date.now() / 1000);
  const generated = await generateKeyPackage({
    credential: { credentialType: defaultCredentialTypes.basic, identity: textEncoder.encode(stablePubkey) },
    cipherSuite: await cipherSuite(),
    lifetime: { notBefore: BigInt(now - 86_400), notAfter: BigInt(now + 31_536_000) },
  });
  const publicBase64 = bytesToBase64(encode(keyPackageEncoder, generated.publicPackage));
  // A stable, browser-local identifier. The coordinator treats it as opaque.
  const reference = crypto.randomUUID();
  return {
    keyPackage: generated.publicPackage,
    privateKeyPackage: generated.privatePackage,
    stored: {
      reference,
      publicBase64,
      privateBase64: bytesToBase64(encode(privateKeyPackageEncoder, generated.privatePackage)),
    },
  };
}

export function decodeLocalKeyPackage(stored: LocalKeyPackage): { keyPackage: KeyPackage; privateKeyPackage: PrivateKeyPackage } {
  return {
    keyPackage: decodeExact(base64ToBytes(stored.publicBase64), keyPackageDecoder, "key package"),
    privateKeyPackage: decodeExact(base64ToBytes(stored.privateBase64), privateKeyPackageDecoder, "private key package"),
  };
}

export async function createRoomState(keyPackage: KeyPackage, privateKeyPackage: PrivateKeyPackage): Promise<ClientState> {
  return createGroup({
    context: { cipherSuite: await cipherSuite(), authService: unsafeTestingAuthenticationService },
    groupId: textEncoder.encode(crypto.randomUUID()),
    keyPackage,
    privateKeyPackage,
  });
}

export function encodeWelcome(welcome: Welcome): string {
  return bytesToBase64(encode(mlsMessageEncoder, { version: 1, wireformat: wireformats.mls_welcome, welcome }));
}

export async function joinWelcome(welcomeBase64: string, stored: LocalKeyPackage): Promise<ClientState> {
  const { keyPackage, privateKeyPackage } = decodeLocalKeyPackage(stored);
  const message = decodeExact(base64ToBytes(welcomeBase64), mlsMessageDecoder, "welcome");
  if (message.wireformat !== wireformats.mls_welcome) throw new Error("Invite did not contain an MLS welcome");
  return joinGroup({
    context: { cipherSuite: await cipherSuite(), authService: unsafeTestingAuthenticationService },
    welcome: message.welcome,
    keyPackage,
    privateKeys: privateKeyPackage,
  });
}

export async function addMember(state: ClientState, memberKeyPackageBase64: string): Promise<{ state: ClientState; commitBase64: string; welcomeBase64: string }> {
  const memberKeyPackage = decodeExact(base64ToBytes(memberKeyPackageBase64), keyPackageDecoder, "member key package");
  const result = await createCommit({
    context: { cipherSuite: await cipherSuite(), authService: unsafeTestingAuthenticationService },
    state,
    ratchetTreeExtension: true,
    extraProposals: [{ proposalType: 1, add: { keyPackage: memberKeyPackage } }],
  });
  if (!result.welcome) throw new Error("Coordinator could not make an invite welcome");
  return {
    state: result.newState,
    commitBase64: bytesToBase64(encode(mlsMessageEncoder, result.commit)),
    welcomeBase64: encodeWelcome(result.welcome.welcome),
  };
}

export async function encryptMessage(state: ClientState, envelope: ChatEnvelope): Promise<{ state: ClientState; opaqueBase64: string }> {
  const result = await createApplicationMessage({
    context: { cipherSuite: await cipherSuite(), authService: unsafeTestingAuthenticationService },
    state,
    message: textEncoder.encode(JSON.stringify(envelope)),
  });
  return { state: result.newState, opaqueBase64: bytesToBase64(encode(mlsMessageEncoder, result.message)) };
}

export async function decryptMessage(state: ClientState, opaqueBase64: string): Promise<{ state: ClientState; envelope?: ChatEnvelope }> {
  const message = decodeExact(base64ToBytes(opaqueBase64), mlsMessageDecoder, "MLS message");
  const result = await processMessage({
    context: { cipherSuite: await cipherSuite(), authService: unsafeTestingAuthenticationService },
    state,
    // The welcome form is rejected above; ts-mls' discriminator is not
    // currently narrowed by TypeScript across its numeric wireformat field.
    message: message as Parameters<typeof processMessage>[0]["message"],
  });
  if (result.kind !== "applicationMessage") return { state: result.newState };
  const candidate = JSON.parse(textDecoder.decode(result.message)) as Partial<ChatEnvelope>;
  if (candidate.type !== "message" || !candidate.id || !candidate.sender || !candidate.name || typeof candidate.content !== "string") {
    throw new Error("Received an invalid chat message");
  }
  return { state: result.newState, envelope: candidate as ChatEnvelope };
}
