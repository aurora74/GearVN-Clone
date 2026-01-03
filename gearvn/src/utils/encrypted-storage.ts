import CryptoJS from "crypto-js";
import type { PersistStorage, StorageValue } from "zustand/middleware";

const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPT_SECRET!;

export const encrypt = (data: string) => {
  return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
};

export const decrypt = (ciphertext: string) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

export const encryptedStorage: PersistStorage<any> = {
  getItem: (name) => {
    const encrypted = localStorage.getItem(name);
    if (!encrypted) return null;

    const decrypted = decrypt(encrypted);
    return JSON.parse(decrypted) as StorageValue<any>;
  },

  setItem: (name, value) => {
    const stringified = JSON.stringify(value);
    const encrypted = encrypt(stringified);
    localStorage.setItem(name, encrypted);
  },

  removeItem: (name) => {
    localStorage.removeItem(name);
  },
};
