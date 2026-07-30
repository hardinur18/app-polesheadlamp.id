import { Hono } from "npm:hono";
import {
  handleKirimdevWebhookReceive,
  handleKirimdevWebhookVerify,
} from "../server/meta_messaging.tsx";

const app = new Hono();

app.get("/", handleKirimdevWebhookVerify);
app.post("/", handleKirimdevWebhookReceive);
app.get("/kirimdev-messaging-webhook", handleKirimdevWebhookVerify);
app.post("/kirimdev-messaging-webhook", handleKirimdevWebhookReceive);

Deno.serve(app.fetch);
