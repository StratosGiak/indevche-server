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
  getRecordPhotos,
  getStore,
  getRecordDataForSms,
  setPhotos,
} from "./database.js";
import {
  Record,
  AuthRequestSchema,
  NewRecord,
  DatabaseRecord,
  SmsType,
} from "./types.js";
import { addDevice, Notifications, sendToAll } from "./tokens.js";
import { rm } from "fs/promises";
import { createPDFForm } from "./pdf.js";
import { randomUUID } from "crypto";
const formDir = `${import.meta.dirname}/../forms/filled`;

const MAX_PHOTOS = 5;

declare module "express-session" {
  export interface SessionData {
    user: { id: number; name: string };
  }
}

async function generateSmsText(type: SmsType, store?: number) {
  switch (type) {
    case SmsType.Repaired: {
      if (!store) return null;
      const { area, address } = await getStore(store);
      if (!area) return null;
      return `Η ΣΥΣΚΕΥΗ ΣΑΣ ΕΙΝΑΙ ΕΤΟΙΜΗ ΓΙΑ ΠΑΡΑΛΑΒΗ ΑΠΟ ΤΟ ΚΑΤΑΣΤΗΜΑ ΜΑΣ ${address}, ${area}.`;
    }
    case SmsType.Unrepairable: {
      return `ΣΑΣ ΕΝΗΜΕΡΩΝΟΥΜΕ ΟΤΙ Η ΣΥΣΚΕΥΗ ΣΑΣ ΕΧΕΙ ΚΡΙΘΕΙ ΑΝΕΠΙΣΚΕΥΑΣΤΗ.\nΠΑΡΑΚΑΛΩ ΓΙΑ ΤΗΝ ΑΜΕΣΗ ΠΑΡΑΛΑΒΗ ΤΗΣ, ΔΙΟΤΙ ΘΑ ΠΡΟΩΘΗΘΕΙ ΣΤΗΝ ΑΝΑΚΥΚΛΩΣΗ ΣΤΟ ΤΕΛΟΣ ΤΗΣ ΕΒΔΟΜΑΔΑΣ`;
    }
    case SmsType.Thanks: {
      if (!store) return null;
      const { phone, link } = await getStore(store);
      return `ΣΑΣ ΕΥΧΑΡΙΣΤΟΥΜΕ ΓΙΑ ΤΗΝ ΕΜΠΙΣΤΟΣΥΝΗ ΠΟΥ ΔΕΙΞΑΤΕ ΣΤΗΝ ΕΤΑΙΡΕΙΑ ΜΑΣ ΚΑΙ ΕΙΜΑΣΤΕ ΠΑΝΤΑ ΣΤΗΝ ΔΙΑΘΕΣΗ ΣΑΣ.\nΤΗΛ. ΕΠΙΚΟΙΝΩΝΙΑΣ: ${phone}\nΑΞΙΟΛΟΓΗΣΤΕ ΜΑΣ ΘΕΤΙΚΑ ΕΔΩ: ${link}`;
    }
  }
}

const redisSessionClient = createClient({ url: "redis://redis_session" });
await redisSessionClient.connect();
const redisStore = new RedisStore({
  client: redisSessionClient,
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

app.post("/login", async function handleLogin(req, res) {
  try {
    const request = AuthRequestSchema.parse(req.body);
    const result = await getUser(request.username);
    if (!result) {
      res.status(404).json({ error: "Username not found" });
      return;
    }
    if (result.password !== request.password) {
      res.status(401).json({ error: "Wrong password" });
      return;
    }
    req.session.regenerate(function regenerate() {
      req.session.user = { id: result.id, name: result.name };
      res.json(req.session.user);
    });
    await addDevice(request.firebaseToken);
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

app.get("/records/all", restrict, async function handleGetAllRecord(req, res) {
  if (req.session.user?.id != 0) {
    res.status(403).json({ error: "Not authorized" });
  }
  const result = await getAllRecords();
  res.json(result);
});

app.post("/records/new", restrict, async function handleNewRecord(req, res) {
  const newRecord = {
    ...req.body,
    mechanic:
      req.session.user!.id == 0 ? req.body.mechanic : req.session.user!.id,
  } as NewRecord;
  try {
    const result = await createRecord(newRecord);
    await setPhotos(result.insertId, newRecord.photos);
    const record = await getRecord(result.insertId);
    if (!record) {
      res.status(500).json({ error: "Insert failed" });
      return;
    }
    res.json(record);
    await sendToAll(Notifications.NewRecord);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Insert failed" });
  }
});

app.get(
  "/records/by/:id",
  restrict,
  async function handleGetRecordsBy(req, res) {
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
  }
);

app.put("/records/:id", restrict, async function handleEditRecord(req, res) {
  try {
    const index = z.coerce.number().int().min(1).parse(req.params.id);
    const oldRecord = await getRecord(index);
    if (!oldRecord) {
      res.status(404).json({ error: "Record ID not found" });
      return;
    }
    const { photos: oldPhotos, mechanic } = oldRecord;
    if (req.session.user?.id != 0 && req.session.user?.id != mechanic) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    const editedRecord = {
      ...req.body,
      mechanic:
        req.session.user!.id == 0 ? req.body.mechanic : req.session.user!.id,
      id: index,
    } as Record;
    await editRecord(editedRecord);
    for (const history of editedRecord.newHistory) {
      await addHistory({
        ...history,
        recordId: index,
        mechanic:
          req.session.user!.id == 0 ? req.body.mechanic : req.session.user!.id,
      });
    }
    await setPhotos(index, editedRecord.photos);
    const newRecord = await getRecord(index);
    if (!newRecord) {
      res.status(500).json({ error: "Update failed" });
      return;
    }
    res.send(newRecord);
    for (const oldPhoto of oldPhotos) {
      if (!newRecord.photos.includes(oldPhoto)) {
        rm(`./public/images/${oldPhoto}`).catch((error) =>
          console.log(`Previous image ${oldPhoto} not found`)
        );
      }
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Update failed" });
  }
});

app.delete(
  "/records/:id",
  restrict,
  async function handleDeleteRecord(req, res) {
    try {
      if (req.session.user?.id != 0) {
        res.status(403).send();
        return;
      }
      const index = z.coerce.number().int().min(1).parse(req.params.id);
      const photos = await getRecordPhotos(index);
      const result = await deleteRecord(index);
      if (!result) {
        res.status(404).json({ error: "Record ID not found" });
        return;
      }
      res.send();
      for (const photo of photos) {
        rm(`./public/images/${photo}`).catch((error) =>
          console.log(`Previous image ${photo} not found`)
        );
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Delete failed" });
    }
  }
);

app.get("/records/:id/form", restrict, async function handleGetForm(req, res) {
  try {
    const index = z.coerce.number().int().min(1).parse(req.params.id);
    const record = await getRecord(index);
    if (!record) {
      res.status(404).json({ error: "Record ID not found" });
      return;
    }
    if (req.session.user?.id != 0 && req.session.user?.id != record.mechanic) {
      res.status(403).send();
      return;
    }
    const filename = await createPDFForm(
      {
        ...record,
        id: req.params.id,
        date: new Date(record.date).toLocaleDateString("en-GB"),
        advance: "€ " + record.advance,
      },
      record.store
    );
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

app.post(
  "/records/:id/sms/:type",
  restrict,
  async function handleSendSms(req, res) {
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
      const record = await getRecordDataForSms(index);
      if (!record) {
        res.status(404).json({ error: "Record not found" });
        return;
      }
      const { store, phone } = record;
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
  }
);
const pending: { [id: string]: express.Response } = {};

app.get("/sms_callback", function handleSmsCallback(req, res) {
  res.send();
  const msgId = req.query.id as string;
  const status = req.query.status as string;
  if (status !== "d") pending[msgId].status(500);
  pending[msgId].send();
  delete pending[msgId];
});

app.get("/records/:id", restrict, async function handleGetRecord(req, res) {
  try {
    const index = z.coerce.number().int().min(1).parse(req.params.id);
    const record = await getRecord(index);
    if (!record) {
      res.status(404).json({ error: "Record ID not found" });
      return;
    }
    if (req.session.user?.id != 0 && req.session.user!.id != record.mechanic) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    res.send(record);
  } catch (error) {
    res.status(400).json({ error: "Invalid record ID requested" });
    return;
  }
});

app.get("/history/:id", restrict, async function handleGetHistory(req, res) {
  try {
    const index = z.coerce.number().int().min(1).parse(req.params.id);
    const history = await getHistory(index);
    if (!history) {
      res.status(404).json({ error: "History ID not found" });
      return;
    }
    if (req.session.user?.id != 0 && req.session.user?.id != history.mechanic) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    res.send(history);
  } catch (error) {
    res.status(400).json({ error: "Invalid history ID requested" });
    return;
  }
});

app.get(
  "/history/of/:id",
  restrict,
  async function handleGetHistoryOf(req, res) {
    try {
      const index = z.coerce.number().int().min(0).parse(req.params.id);
      if (req.session.user?.id != 0 && req.session.user?.id != index) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }
      const history = await getAllHistoryOf(index);
      if (!history) {
        res.status(404).json({ error: "Record ID not found" });
        return;
      }
      res.send(history);
    } catch (error) {
      res.status(400).json({ error: "Invalid record ID requested" });
      return;
    }
  }
);

app.get(
  "/suggestions",
  restrict,
  async function handleGetSuggestions(req, res) {
    const suggestions = await getAllSuggestions();
    res.json(suggestions);
  }
);

const uploadPhoto = multer({
  dest: "./public/images",
  limits: { fileSize: 2e6 },
});
app.post("/media", restrict, function handlePostPhoto(req, res) {
  uploadPhoto.array("file", MAX_PHOTOS)(req, res, (err) => {
    if (err || !req.files) {
      console.log(err);
      res.status(500).send();
      return;
    }
    const filenames = (req.files as Express.Multer.File[]).map(
      (f) => f.filename
    );
    res.json(filenames);
  });
});

app.listen(process.env.PORT, () => {
  console.log(`Started server at port ${process.env.PORT}`);
});
