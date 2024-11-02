import "dotenv/config";
import express from "express";
import { z } from "zod";
import {
  getRecord,
  getAllOptions,
  getAllRecordsByMechanic,
  getAllRecords,
  getUser,
  getHistory,
  getAllHistoryOf,
} from "./database.ts";
import { Record, AuthRequestSchema } from "./types.ts";

const app = express();

app.use(express.json());

app.post("/login", async (req, res) => {
  try {
    const user = AuthRequestSchema.parse(req.body);
    const { id, onoma, password } = await getUser(user.username);
    if (!id) {
      res.status(404).json({ error: "Username not found" });
      return;
    }
    if (password !== user.password) {
      res.status(401).json({ error: "Wrong password" });
      return;
    }
    res.json({
      token: "abcde",
      user: { id: id, name: onoma, username: user.username },
    });
  } catch (error) {
    res.status(400).json({ error: "Bad request" });
  }
});

app.get("/records/all", async (req, res) => {
  const result = await getAllRecords();
  res.json(result);
});

app.post("/records/new", async (req, res) => {
  const params = req.body as Record;
  console.log(params);
  res.status(200).json(params);
});

app.get("/records/by/:id", async (req, res) => {
  try {
    const index = z.coerce.number().int().min(1).parse(req.params.id);
    const result = await getAllRecordsByMechanic(index);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: "Invalid mechanic ID requested" });
  }
});

app.put("/records/:id/edit", async (req, res) => {
  const params = req.body as Record;
  console.log(params);
  res.status(200).json(params);
});

app.get("/records/:id", async (req, res) => {
  try {
    const index = z.coerce.number().int().min(1).parse(req.params.id);
    const result = await getRecord(index);
    if (!result) {
      res.status(404).json({ error: "Record ID not found" });
      return;
    }
    res.send(result);
  } catch (error) {
    res.status(400).json({ error: "Invalid record ID requested" });
    return;
  }
});

app.get("/history/:id", async (req, res) => {
  try {
    const index = z.coerce.number().int().min(1).parse(req.params.id);
    const result = await getHistory(index);
    if (!result) {
      res.status(404).json({ error: "History ID not found" });
      return;
    }
    res.send(result);
  } catch (error) {
    res.status(400).json({ error: "Invalid history ID requested" });
    return;
  }
});

app.get("/history/of/:id", async (req, res) => {
  try {
    const index = z.coerce.number().int().min(1).parse(req.params.id);
    const result = await getAllHistoryOf(index);
    if (!result) {
      res.status(404).json({ error: "Record ID not found" });
      return;
    }
    res.send(result);
  } catch (error) {
    res.status(400).json({ error: "Invalid record ID requested" });
    return;
  }
});

app.get("/constants", async (req, res) => {
  const result = await getAllOptions();
  res.json(result);
});

app.listen(process.env.PORT, () => {
  console.log("Started server at port " + process.env.PORT);
});
