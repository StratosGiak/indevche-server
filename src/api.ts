import "dotenv/config";
import express from "express";
import multer from "multer";
import { z } from "zod";
import {
  getRecord,
  getAllSuggestions,
  getAllRecordsByMechanic,
  getAllRecords,
  getUser,
  getHistory,
  getAllHistoryOf,
  createRecord,
  editRecord,
} from "./database.js";
import { Record, AuthRequestSchema, NewRecord } from "./types.js";

const app = express();

app.use(express.json());
app.use(express.static("public"));

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
  const newRecord = req.body as NewRecord;
  try {
    const result = await createRecord(newRecord);
    const record = await getRecord(result.insertId);
    res.status(200).json(record);
  } catch (error) {
    res.status(500).json({ error: "Insert failed" });
  }
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
  const newRecord = req.body as Record;
  try {
    const result = await editRecord(newRecord);
    const record = await getRecord(newRecord.id);
    res.status(200).send(record);
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
  }
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

app.get("/suggestions", async (req, res) => {
  const result = await getAllSuggestions();
  res.json(result);
});

app.get("/media/:filename", (req, res) => {
  res.sendFile(req.params.filename, {
    root: "./public/images",
  });
});
const uploadPhoto = multer({ dest: "./public/images" });
app.post("/media", (req, res) => {
  uploadPhoto.single("file")(req, res, (err) => {
    if (err || !req.file) {
      console.log(err);
      res.status(500).send();
      return;
    }
    res.send(req.file.filename);
  });
});

app.listen(process.env.PORT, () => {
  console.log(`Started server at port ${process.env.PORT}`);
});
