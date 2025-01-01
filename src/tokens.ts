import admin from "firebase-admin";
import { createClient } from "redis";

export enum Notifications {
  NewRecord,
}

const redisTokenClient = createClient({ url: "redis://redis_token" });
await redisTokenClient.connect();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const messaging = admin.messaging();

export async function addDevice(token: string) {
  await redisTokenClient.sAdd("tokens", token);
}

export async function sendToAll(type: Notifications) {
  const tokens = await redisTokenClient.sMembers("tokens");
  const message: admin.messaging.MulticastMessage = {
    tokens: tokens,
    notification: { title: "Rodis Service", body: "Δημιουργήθηκε νέα εντολή" },
    android: { priority: "high" },
  };
  await messaging.sendEachForMulticast(message);
}
