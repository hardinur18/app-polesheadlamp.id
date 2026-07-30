import { Hono } from "npm:hono";
import {
  handleMetaMessagingWebhookReceive,
  handleMetaMessagingWebhookVerify,
} from "../server/meta_messaging.tsx";

const app = new Hono();

app.get("/", handleMetaMessagingWebhookVerify);
app.post("/", handleMetaMessagingWebhookReceive);
app.get("/meta-messaging-webhook", handleMetaMessagingWebhookVerify);
app.post("/meta-messaging-webhook", handleMetaMessagingWebhookReceive);

Deno.serve(app.fetch);
