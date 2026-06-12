import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import nacl from "tweetnacl";
import * as naclUtil from "tweetnacl-util";

import { registerPrivateChatDevice } from "../api/privateChatApi";

const IDENTITY_STORAGE_PREFIX = "shekinah.privateChat.identity.v1";
const PROTOCOL_VERSION = "e2ee-v1";

let prngReady = false;

function configurePrng() {
  if (prngReady) return;

  nacl.setPRNG((target, size) => {
    const bytes =
      typeof Crypto.getRandomBytes === "function"
        ? Crypto.getRandomBytes(size)
        : Crypto.getRandomValues(new Uint8Array(size));

    for (let index = 0; index < size; index += 1) {
      target[index] = bytes[index];
    }
  });

  prngReady = true;
}

function randomDeviceId() {
  const bytes =
    typeof Crypto.getRandomBytes === "function"
      ? Crypto.getRandomBytes(10)
      : Crypto.getRandomValues(new Uint8Array(10));
  return `mobile-${naclUtil.encodeBase64(bytes).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;
}

function encode(bytes) {
  return naclUtil.encodeBase64(bytes);
}

function decode(value) {
  return naclUtil.decodeBase64(value);
}

function encodeUtf8(value) {
  return naclUtil.decodeUTF8(value);
}

function decodeUtf8(bytes) {
  return naclUtil.encodeUTF8(bytes);
}

function signaturePayload({
  threadId,
  recipientDeviceId,
  protocolVersion,
  nonce,
  senderCopyNonce,
  senderEphemeralPublicKey,
  ciphertext,
  senderCopyCiphertext
}) {
  return [
    "private-chat-message-v1",
    threadId,
    recipientDeviceId || "",
    protocolVersion || PROTOCOL_VERSION,
    nonce,
    senderCopyNonce,
    senderEphemeralPublicKey,
    ciphertext,
    senderCopyCiphertext
  ].join(".");
}

function identityStorageKey(userId) {
  const cleanUserId = typeof userId === "string" ? userId.trim() : "";
  if (!cleanUserId) {
    throw new Error("Signed-in user id is required for private chat identity.");
  }
  return `${IDENTITY_STORAGE_PREFIX}.${cleanUserId}`;
}

function normalizeIdentity(raw) {
  return {
    deviceId: raw.deviceId,
    label: raw.label || "Primary device",
    identityPublicKey: raw.identityPublicKey,
    identitySecretKey: raw.identitySecretKey,
    signingPublicKey: raw.signingPublicKey,
    signingSecretKey: raw.signingSecretKey,
    createdAt: raw.createdAt || new Date().toISOString()
  };
}

export async function getOrCreatePrivateChatIdentity(userId) {
  configurePrng();
  const storageKey = identityStorageKey(userId);

  const existing = await AsyncStorage.getItem(storageKey);
  if (existing) {
    try {
      return normalizeIdentity(JSON.parse(existing));
    } catch {
      await AsyncStorage.removeItem(storageKey);
    }
  }

  const identityKeys = nacl.box.keyPair();
  const signingKeys = nacl.sign.keyPair();

  const identity = {
    deviceId: randomDeviceId(),
    label: "Primary device",
    identityPublicKey: encode(identityKeys.publicKey),
    identitySecretKey: encode(identityKeys.secretKey),
    signingPublicKey: encode(signingKeys.publicKey),
    signingSecretKey: encode(signingKeys.secretKey),
    createdAt: new Date().toISOString()
  };

  await AsyncStorage.setItem(storageKey, JSON.stringify(identity));
  return identity;
}

export async function ensurePrivateChatDevice(userId) {
  const identity = await getOrCreatePrivateChatIdentity(userId);

  await registerPrivateChatDevice({
    deviceId: identity.deviceId,
    label: identity.label,
    identityPublicKey: identity.identityPublicKey,
    signingPublicKey: identity.signingPublicKey
  });

  return identity;
}

export async function publicKeyFingerprint(publicKey) {
  if (!publicKey || typeof publicKey !== "string") return "";
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    publicKey.trim()
  );
  return digest.slice(0, 12).toUpperCase();
}

export async function encryptPrivateChatMessage({
  currentUserId,
  threadId,
  text,
  recipientPublicKey,
  recipientDeviceId
}) {
  const identity = await getOrCreatePrivateChatIdentity(currentUserId);
  const payload = JSON.stringify({
    type: "text",
    text,
    sentAt: new Date().toISOString()
  });

  const senderEphemeralKeys = nacl.box.keyPair();
  const nonceBytes =
    typeof Crypto.getRandomBytes === "function"
      ? Crypto.getRandomBytes(nacl.box.nonceLength)
      : Crypto.getRandomValues(new Uint8Array(nacl.box.nonceLength));
  const senderCopyNonceBytes =
    typeof Crypto.getRandomBytes === "function"
      ? Crypto.getRandomBytes(nacl.box.nonceLength)
      : Crypto.getRandomValues(new Uint8Array(nacl.box.nonceLength));

  const messageBytes = encodeUtf8(payload);
  const recipientCiphertext = nacl.box(
    messageBytes,
    nonceBytes,
    decode(recipientPublicKey),
    senderEphemeralKeys.secretKey
  );
  const senderCopyCiphertext = nacl.box(
    messageBytes,
    senderCopyNonceBytes,
    decode(identity.identityPublicKey),
    senderEphemeralKeys.secretKey
  );

  const body = {
    ciphertext: encode(recipientCiphertext),
    nonce: encode(nonceBytes),
    senderEphemeralPublicKey: encode(senderEphemeralKeys.publicKey),
    senderCopyCiphertext: encode(senderCopyCiphertext),
    senderCopyNonce: encode(senderCopyNonceBytes),
    recipientDeviceId: recipientDeviceId || "",
    protocolVersion: PROTOCOL_VERSION
  };

  const signature = nacl.sign.detached(
    encodeUtf8(
      signaturePayload({
        threadId,
        recipientDeviceId: body.recipientDeviceId,
        protocolVersion: body.protocolVersion,
        nonce: body.nonce,
        senderCopyNonce: body.senderCopyNonce,
        senderEphemeralPublicKey: body.senderEphemeralPublicKey,
        ciphertext: body.ciphertext,
        senderCopyCiphertext: body.senderCopyCiphertext
      })
    ),
    decode(identity.signingSecretKey)
  );

  return {
    ...body,
    signature: encode(signature)
  };
}

function parseDecryptedPayload(bytes) {
  const text = decodeUtf8(bytes);

  try {
    return JSON.parse(text);
  } catch {
    return {
      type: "text",
      text
    };
  }
}

export async function decryptPrivateChatMessage({
  threadId,
  currentUserId,
  peerSigningKey,
  message
}) {
  const identity = await getOrCreatePrivateChatIdentity(currentUserId);
  const verifier = message.senderUserId === currentUserId ? identity.signingPublicKey : peerSigningKey;
  const payload = signaturePayload({
    threadId,
    recipientDeviceId: message.recipientDeviceId,
    protocolVersion: message.protocolVersion,
    nonce: message.nonce,
    senderCopyNonce: message.senderCopyNonce,
    senderEphemeralPublicKey: message.senderEphemeralPublicKey,
    ciphertext: message.ciphertext,
    senderCopyCiphertext: message.senderCopyCiphertext
  });

  if (!verifier) {
    throw new Error("Missing signing key for encrypted chat verification.");
  }

  const verified = nacl.sign.detached.verify(
    encodeUtf8(payload),
    decode(message.signature),
    decode(verifier)
  );

  if (!verified) {
    throw new Error("Encrypted chat signature verification failed.");
  }

  const plaintextBytes =
    message.senderUserId === currentUserId
      ? nacl.box.open(
          decode(message.senderCopyCiphertext),
          decode(message.senderCopyNonce),
          decode(message.senderEphemeralPublicKey),
          decode(identity.identitySecretKey)
        )
      : nacl.box.open(
          decode(message.ciphertext),
          decode(message.nonce),
          decode(message.senderEphemeralPublicKey),
          decode(identity.identitySecretKey)
        );

  if (!plaintextBytes) {
    throw new Error("Encrypted message could not be opened on this device.");
  }

  return parseDecryptedPayload(plaintextBytes);
}
