import "dotenv/config";
import express from "express";
import session from "express-session";
import RedisStore from "connect-redis";
import { createClient } from "redis";
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
  addHistory,
  deleteRecord,
  getRecordPhoto,
} from "./database.js";
import {
  Record,
  AuthRequestSchema,
  NewRecord,
  DatabaseRecord,
} from "./types.js";
import { rm } from "fs/promises";

declare module "express-session" {
  export interface SessionData {
    user: { id: number; name: string };
  }
}

const redisClient = createClient({ url: "redis://redis_cache" });
redisClient.connect();
const redisStore = new RedisStore({
  client: redisClient,
  prefix: "rodis",
});
const app = express();

app.use(
  session({
    store: redisStore,
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET!,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
function convertRecord(record: DatabaseRecord) {
  return {
    id: record.id,
    date: record.datek,
    name: record.onomatep,
    address: record.odos,
    area: record.perioxi,
    city: record.poli,
    postalCode: record.tk,
    phoneMobile: record.kinito,
    phoneHome: record.tilefono,
    email: record.email,
    product: record.eidos,
    manufacturer: record.marka,
    serial: record.serialnr,
    hasWarranty: record.warranty,
    warrantyDate: record.datekwarr,
    fee: record.pliromi,
    advance: record.prokatavoli,
    status: record.katastasi_p,
    mechanic: record.mastoras_p,
    photo: record.photo,
    notesReceived: record.paratiriseis_para,
    notesRepaired: record.paratiriseis_epi,
    store: record.katastima,
  } as Record;
}

app.post("/login", async (req, res) => {
  try {
    const user = AuthRequestSchema.parse(req.body);
    const result = await getUser(user.username);
    if (!result) {
      res.status(404).json({ error: "Username not found" });
      return;
    }
    const { id, onoma, password } = result;
    if (password !== user.password) {
      res.status(401).json({ error: "Wrong password" });
      return;
    }
    req.session.regenerate(function regenerate() {
      req.session.user = { id: id, name: onoma };
      res.json(req.session.user);
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: "Bad request" });
  }
});

function restrict(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (req.session.user) next();
  else {
    res.status(403).json({ error: "Authentication required" });
  }
}

app.get("/records/all", restrict, async (req, res) => {
  if (req.session.user?.id != 0) {
    res.status(403).json({ error: "Not authorized" });
  }
  const result = await getAllRecords();
  res.json(result);
});

app.post("/records/new", restrict, async (req, res) => {
  const newRecord = {
    ...req.body,
    mechanic:
      req.session.user!.id == 0 ? req.body.mechanic : req.session.user!.id,
  } as NewRecord;
  try {
    const result = await createRecord(newRecord);
    const record = await getRecord(result.insertId);
    res.json(record);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Insert failed" });
  }
});

app.get("/records/by/:id", restrict, async (req, res) => {
  try {
    const index = z.coerce.number().int().min(0).parse(req.params.id);
    if (req.session.user?.id != 0 && req.session.user?.id != index) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    const result = await getAllRecordsByMechanic(index);
    res.json(result);
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: "Invalid mechanic ID requested" });
  }
});

app.put("/records/:id", restrict, async (req, res) => {
  try {
    const index = z.coerce.number().int().min(1).parse(req.params.id);
    const result = await getRecord(index);
    if (!result) {
      res.status(404).json({ error: "Record ID not found" });
      return;
    }
    const { photo: oldPhoto, mastoras_p: mechanic } = result;
    if (req.session.user?.id != 0 && req.session.user?.id != mechanic) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    const newRecord = {
      ...req.body,
      mechanic:
        req.session.user!.id == 0 ? req.body.mechanic : req.session.user!.id,
      id: index,
    } as Record;
    await editRecord(newRecord);
    for (const history of newRecord.newHistory) {
      await addHistory({
        ...history,
        recordId: index,
        mechanic:
          req.session.user!.id == 0 ? req.body.mechanic : req.session.user!.id,
      });
    }
    const record = await getRecord(index);
    res.send(record);
    if (oldPhoto && oldPhoto != record.photo) {
      rm(`./public/images/${oldPhoto}`).catch((error) =>
        console.log(`Previous image ${oldPhoto} not found`)
      );
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Update failed" });
  }
});

app.delete("/records/:id", restrict, async (req, res) => {
  try {
    if (req.session.user?.id != 0) {
      res.status(403).send();
      return;
    }
    const index = z.coerce.number().int().min(1).parse(req.params.id);
    const { photo } = await getRecordPhoto(index);
    const result = await deleteRecord(index);
    if (!result) {
      res.status(404).json({ error: "Record ID not found" });
      return;
    }
    res.send();
    if (photo) {
      rm(`./public/images/${photo}`).catch((error) =>
        console.log(`Previous image ${photo} not found`)
      );
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Delete failed" });
  }
});

app.get("/records/:id", restrict, async (req, res) => {
  try {
    const index = z.coerce.number().int().min(1).parse(req.params.id);
    const result = await getRecord(index);
    if (!result) {
      res.status(404).json({ error: "Record ID not found" });
      return;
    }
    if (
      req.session.user?.id != 0 &&
      req.session.user!.id != result.mastoras_p
    ) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    res.send(result);
  } catch (error) {
    res.status(400).json({ error: "Invalid record ID requested" });
    return;
  }
});

app.get("/history/:id", restrict, async (req, res) => {
  try {
    const index = z.coerce.number().int().min(1).parse(req.params.id);
    const result = await getHistory(index);
    if (!result) {
      res.status(404).json({ error: "History ID not found" });
      return;
    }
    if (
      req.session.user?.id != 0 &&
      req.session.user?.id != result.mastoras_p
    ) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    res.send(result);
  } catch (error) {
    res.status(400).json({ error: "Invalid history ID requested" });
    return;
  }
});

app.get("/history/of/:id", restrict, async (req, res) => {
  try {
    const index = z.coerce.number().int().min(0).parse(req.params.id);
    if (req.session.user?.id != 0 && req.session.user?.id != index) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
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

app.get("/suggestions", restrict, async (req, res) => {
  const result = await getAllSuggestions();
  res.json(result);
});

const uploadPhoto = multer({
  dest: "./public/images",
  limits: { fileSize: 2e6 },
});
app.post("/media", restrict, (req, res) => {
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
