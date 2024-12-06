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
  getStore,
  getRecordDataForSms,
} from "./database.js";
import {
  Record,
  AuthRequestSchema,
  NewRecord,
  DatabaseRecord,
  SmsType,
} from "./types.js";
import { rm } from "fs/promises";
import { createPDFForm } from "./pdf.js";
import { randomUUID } from "crypto";
const formDir = `${import.meta.dirname}/../forms/filled`;

declare module "express-session" {
  export interface SessionData {
    user: { id: number; name: string };
  }
}

async function generateSmsText(type: SmsType, store?: number) {
  switch (type) {
    case SmsType.Repaired:
      if (!store) return null;
      const { onoma: area, odos: address } = await getStore(store);
      if (!area) return null;
      return `Η ΣΥΣΚΕΥΗ ΣΑΣ ΕΙΝΑΙ ΕΤΟΙΜΗ ΓΙΑ ΠΑΡΑΛΑΒΗ ΑΠΟ ΤΟ ΚΑΤΑΣΤΗΜΑ ΜΑΣ ${address}, ${area}.\nΑΞΙΟΛΟΓΗΣΤΕ ΜΑΣ ΘΕΤΙΚΑ ΕΔΩ : https://g.page/r/CcwC4xOwTPfIEB0/review`;
    case SmsType.Unrepairable:
      return `ΣΑΣ ΕΝΗΜΕΡΩΝΟΥΜΕ ΟΤΙ Η ΣΥΣΚΕΥΗ ΣΑΣ ΕΧΕΙ ΚΡΙΘΕΙ ΑΝΕΠΙΣΚΕΥΑΣΤΗ.\nΠΑΡΑΚΑΛΩ ΓΙΑ ΤΗΝ ΑΜΕΣΗ ΠΑΡΑΛΑΒΗ ΤΗΣ, ΔΙΟΤΙ ΘΑ ΠΡΟΩΘΗΘΕΙ ΣΤΗΝ ΑΝΑΚΥΚΛΩΣΗ ΣΤΟ ΤΕΛΟΣ ΤΗΣ ΕΒΔΟΜΑΔΑΣ`;
    case SmsType.Thanks:
      return "ΕΥΧΑΡΙΣΤΟΥΜΕ ΓΙΑ ΤΗΝ ΠΡΟΤΙΜΗΣΗ ΣΑΣ. ΕΙΜΑΣΤΕ ΠΑΝΤΑ ΣΤΗ ΔΙΑΘΕΣΗ ΣΑΣ";
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
app.use(express.static(formDir));

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
    if (!record) {
      res.status(500).json({ error: "Insert failed" });
      return;
    }
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
    if (!record) {
      res.status(500).json({ error: "Update failed" });
      return;
    }
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

app.get("/records/:id/form", restrict, async (req, res) => {
  try {
    const index = z.coerce.number().int().min(1).parse(req.params.id);
    const result = await getRecord(index);
    if (!result) {
      res.status(404).json({ error: "Record ID not found" });
      return;
    }
    const record = convertRecord(result);
    if (req.session.user?.id != 0 && req.session.user?.id != record.mechanic) {
      res.status(403).send();
      return;
    }
    const filename = await createPDFForm({
      ...record,
      id: req.params.id,
      phone: record.phoneMobile,
      date: new Date(record.date).toLocaleDateString("en-GB"),
      advance: "€ " + record.advance,
    });
    if (!filename) {
      res.status(500).send();
      return;
    }
    res.send(filename);
  } catch (error) {
    res.status(500).json({ error: "Could not generate PDF" });
    return;
  }
});

app.post("/records/:id/sms/:type", restrict, async (req, res) => {
  try {
    const index = z.coerce.number().int().min(1).parse(req.params.id);
    const type = ((type: string) => {
      switch (true) {
        case type === "repaired":
          return SmsType.Repaired;
        case type === "unrepairable":
          return SmsType.Unrepairable;
        case type === "thanks":
          return SmsType.Thanks;
        default:
          return null;
      }
    })(req.params.type);
    if (type === null) {
      res.status(400).json({ error: "Invalid SMS type" });
      return;
    }
    const { katastima: store, kinito: phone } = await getRecordDataForSms(
      index
    );
    const text = await generateSmsText(type, store);
    if (!phone || !text) {
      res.status(400).json({ error: "Cannot send SMS" });
      return;
    }
    const msgId = randomUUID();
    const response = await fetch(
      "https://easysms.gr/api/sms/send?" +
        new URLSearchParams({
          key: process.env.SMS_API_KEY!,
          text: text,
          from: "RodiService",
          to: phone,
          callback:
            `http://188.245.190.233/api/sms_callback?` +
            new URLSearchParams({ id: msgId }),
        }).toString(),
      { method: "POST" }
    );
    if (!response) {
      res.status(500).send();
      return;
    }
    pending[msgId] = res;
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: "Error while sending SMS" });
    return;
  }
});
const pending: { [id: string]: express.Response } = {};

app.get("/sms_callback", (req, res) => {
  res.send();
  const msgId = req.query.id as string;
  const status = req.query.status as string;
  if (status !== "d") pending[msgId].status(500);
  pending[msgId].send();
  delete pending[msgId];
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
