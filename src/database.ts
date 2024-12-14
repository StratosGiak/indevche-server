import "dotenv/config";
import { createPool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  DatabaseHistory,
  DatabaseRecord,
  DatabaseStore,
  DatabaseUser,
  History,
  NewHistory,
  NewRecord,
  Photo,
  Record,
  Store,
  User,
} from "./types.js";

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
    photos: record.photos,
    notesReceived: record.paratiriseis_para,
    notesRepaired: record.paratiriseis_epi,
    store: record.katastima,
    history: record.istoriko.map((h) => convertHistory(h)),
  } as Record;
}

function convertUser(user: DatabaseUser) {
  return {
    id: user.id,
    name: user.onoma,
    username: user.username,
    password: user.password,
  } as User;
}

function convertHistory(history: DatabaseHistory) {
  return {
    id: history.id,
    recordId: history.episkevi_id,
    mechanic: history.mastoras_p,
    date: history.datek,
    notes: history.paratiriseis,
  } as History;
}

function convertStore(store: DatabaseStore) {
  return {
    area: store.onoma,
    address: store.odos,
    phone: store.tilefono,
    link: store.link,
  } as Store;
}

const pool = createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export async function getUser(username: string) {
  const [result, _] = await pool.execute<DatabaseUser[]>(
    "SELECT * FROM mastores WHERE username = ?",
    [username]
  );
  if (!result[0]) return null;
  return convertUser(result[0]);
}

export async function getRecord(index: number) {
  const [result, _] = await pool.execute<DatabaseRecord[]>(
    "SELECT * FROM episkeves WHERE id = ?",
    [index]
  );
  if (!result[0]) return;
  result[0].istoriko = await getAllHistoryOfUnconverted(result[0].id);
  result[0].photos = await getRecordPhotos(index);
  return convertRecord(result[0]);
}

export async function createRecord(record: NewRecord) {
  const [result, packet] = await pool.execute<ResultSetHeader>(
    `INSERT INTO episkeves
    (datek, onomatep, odos, perioxi, poli, tk,
    kinito, tilefono, email, eidos, marka, serialnr,
    warranty, datekwarr, pliromi, prokatavoli, katastasi_p, mastoras_p,
    paratiriseis_para, paratiriseis_epi, katastima) VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.date,
      record.name,
      record.address,
      record.area,
      record.city,
      record.postalCode,
      record.phoneMobile,
      record.phoneHome,
      record.email,
      record.product,
      record.manufacturer,
      record.serial,
      record.hasWarranty,
      record.warrantyDate,
      record.fee,
      record.advance,
      record.status,
      record.mechanic,
      record.notesReceived,
      record.notesRepaired,
      record.store,
    ]
  );
  return result;
}

export async function editRecord(record: Record) {
  const [result, packet] = await pool.execute<ResultSetHeader>(
    `UPDATE episkeves SET
    datek = ?, onomatep = ?, odos = ?, perioxi = ?, poli = ?, tk = ?,
    kinito = ?, tilefono = ?, email = ?, eidos = ?, marka = ?, serialnr = ?,
    warranty = ?, datekwarr = ?, pliromi = ?, prokatavoli = ?, katastasi_p = ?,
    paratiriseis_para = ?, paratiriseis_epi = ?, katastima = ?, mastoras_p = ?
    WHERE id = ?`,
    [
      record.date,
      record.name,
      record.address,
      record.area,
      record.city,
      record.postalCode,
      record.phoneMobile,
      record.phoneHome,
      record.email,
      record.product,
      record.manufacturer,
      record.serial,
      record.hasWarranty,
      record.warrantyDate,
      record.fee,
      record.advance,
      record.status,
      record.notesReceived,
      record.notesRepaired,
      record.store,
      record.mechanic,
      record.id,
    ]
  );
  return result;
}

export async function deleteRecord(index: number) {
  const [result, _] = await pool.execute<ResultSetHeader>(
    "DELETE FROM episkeves WHERE id = ?",
    [index]
  );
  return result;
}

export async function getRecordPhotos(index: number): Promise<string[]> {
  const [result, _] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM photos WHERE episkevi_id = ? ORDER BY seira",
    [index]
  );
  return result.map((p) => p["id"]);
}

export async function addHistory(history: NewHistory) {
  const [result, _] = await pool.execute<ResultSetHeader>(
    `INSERT INTO istorika
    (datek, paratiriseis, episkevi_id, mastoras_p) VALUES
    (?, ?, ?, ?)`,
    [history.date, history.notes, history.recordId, history.mechanic]
  );
  return result;
}

export async function addPhoto(photo: Photo) {
  const [result, _] = await pool.execute<ResultSetHeader>(
    `INSERT INTO photos
    (id, episkevi_id, seira) VALUES
    (?, ?, ?)`,
    [photo.id, photo.recordId, photo.order]
  );
  return result;
}

export async function removeAllPhotos(index: number) {
  const [result, _] = await pool.execute<ResultSetHeader>(
    `DELETE FROM photos WHERE episkevi_id = ?`,
    [index]
  );
  return result;
}

export async function setPhotos(index: number, photos: string[]) {
  await removeAllPhotos(index);
  for (const [i, photo] of photos.entries()) {
    addPhoto({ id: photo, recordId: index, order: i });
  }
}

export async function getAllRecords() {
  const [result, _] = await pool.execute<DatabaseRecord[]>(
    "SELECT * FROM episkeves"
  );
  for (const record of result) {
    record.istoriko = await getAllHistoryOfUnconverted(record.id);
    record.photos = await getRecordPhotos(record.id);
  }
  return result.map((r) => convertRecord(r));
}

export async function getAllRecordsByMechanic(id: number) {
  const [result, _] = await pool.execute<DatabaseRecord[]>(
    "SELECT * FROM episkeves WHERE mastoras_p = ? AND katastasi_p != 4",
    [id]
  );
  for (const record of result) {
    record.istoriko = await getAllHistoryOfUnconverted(record.id);
    record.photos = await getRecordPhotos(record.id);
  }
  return result.map((r) => convertRecord(r));
}

export async function getHistory(index: number) {
  const [result, _] = await pool.execute<DatabaseHistory[]>(
    "SELECT * FROM istorika WHERE id = ?",
    [index]
  );
  if (!result[0]) return null;
  return convertHistory(result[0]);
}

export async function getAllHistoryOfUnconverted(index: number) {
  const [result, _] = await pool.execute<DatabaseHistory[]>(
    `SELECT ir.* FROM istorika_read ir
    JOIN istorika i ON ir.id = i.id
    WHERE i.episkevi_id = ? ORDER BY datek DESC`,
    [index]
  );
  return result;
}

export async function getAllHistoryOf(index: number) {
  const result = await getAllHistoryOfUnconverted(index);
  return result.map((h) => convertHistory(h));
}

export async function getAllSuggestions() {
  return {
    mechanics: await getAllMechanics(),
    statuses: await getAllStatuses(),
    products: await getAllProducts(),
    manufacturers: await getAllManufacturers(),
    stores: await getAllStores(),
    damages: await getAllDamages(),
  };
}

export async function getAllMechanics() {
  const [result, _] = await pool.execute(
    "SELECT id, onoma FROM mastores WHERE id != 0"
  );
  return result;
}

export async function getAllStatuses() {
  const [result, _] = await pool.execute(
    "SELECT * FROM katastaseis ORDER BY id"
  );
  return result;
}

export async function getAllProducts() {
  const [result, _] = await pool.execute("SELECT * FROM eidi");
  return result;
}

export async function getAllManufacturers() {
  const [result, _] = await pool.execute("SELECT * FROM markes");
  return result;
}

export async function getAllStores() {
  const [result, _] = await pool.execute("SELECT * FROM katastimata");
  return result;
}

export async function getAllDamages() {
  const [result, _] = await pool.execute(
    "SELECT * FROM symptomata ORDER BY id"
  );
  return result;
}

export async function getStore(id: number) {
  const [result, _] = await pool.execute<DatabaseStore[]>(
    "SELECT onoma, odos, tilefono, link FROM katastimata WHERE id = ?",
    [id]
  );
  return convertStore(result[0]);
}

export async function getRecordDataForSms(id: number) {
  const [result, _] = await pool.execute<DatabaseRecord[]>(
    "SELECT katastima, mastoras_p, onomatep, kinito FROM episkeves WHERE id = ?",
    [id]
  );
  const record = result[0];
  if (!record) return null;
  return {
    store: record.katastima,
    mechanic: record.mastoras_p,
    name: record.onomatep,
    phone: record.kinito,
  };
}
