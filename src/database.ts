import "dotenv/config";
import { createPool, ResultSetHeader } from "mysql2/promise";
import { AuthResponse, History, NewRecord, Record } from "./types.js";

const pool = createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export async function getUser(username: string) {
  const [result, _] = await pool.execute<AuthResponse[]>(
    "SELECT id, onoma, password FROM mastores WHERE username = ?",
    [username]
  );
  return result[0];
}

export async function getRecord(index: number) {
  const [result, _] = await pool.execute<Record[]>(
    "SELECT * FROM episkeves WHERE id = ?",
    [index]
  );
  return result[0];
}

export async function createRecord(record: NewRecord) {
  const [result, packet] = await pool.execute<ResultSetHeader>(
    `INSERT INTO episkeves
    (datek, onomatep, odos, perioxi, poli, tk,
    kinito, tilefono, email, eidos, marka, serialnr,
    warranty, datekwarr, katastasi_p, mastoras_p, photo1, paratiriseis_para, paratiriseis_epi) VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      record.status,
      record.mechanic,
      record.photo,
      record.notesReceived,
      record.notesRepaired,
    ]
  );
  return result;
}

export async function editRecord(record: Record) {
  const [result, packet] = await pool.execute<ResultSetHeader>(
    `UPDATE episkeves SET
    datek = ?, onomatep = ?, odos = ?, perioxi = ?, poli = ?, tk = ?,
    kinito = ?, tilefono = ?, email = ?, eidos = ?, marka = ?, serialnr = ?,
    warranty = ?, datekwarr = ?, katastasi_p = ?, mastoras_p = ?, photo1 = ?, paratiriseis_para = ?, paratiriseis_epi = ?
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
      record.status,
      record.mechanic,
      record.photo,
      record.notesReceived,
      record.notesRepaired,
      record.id,
    ]
  );
  return result;
}

export async function getAllRecords() {
  const [result, _] = await pool.execute<Record[]>("SELECT * FROM episkeves");
  return result;
}

export async function getAllRecordsByMechanic(id: number) {
  const [result, _] = await pool.execute<Record[]>(
    "SELECT * FROM episkeves WHERE mastoras_p = ?",
    [id]
  );
  for (const record of result) {
    record.istorika = await getAllHistoryOf(record.id);
  }
  return result;
}

export async function getHistory(index: number) {
  const [result, _] = await pool.execute<History[]>(
    "SELECT * FROM istorika WHERE id = ?",
    [index]
  );
  return result[0];
}

export async function getAllHistoryOf(index: number) {
  const [result, _] = await pool.execute<History[]>(
    `SELECT ir.* FROM istorika_read ir
    JOIN istorika i ON ir.id = i.id
    WHERE i.episkevi_id = ?`,
    [index]
  );
  return result;
}

export async function getAllSuggestions() {
  return {
    //mechanics: await getAllMechanics(),
    states: await getAllStates(),
    products: await getAllProducts(),
    manufacturers: await getAllManufacturers(),
  };
}

export async function getAllMechanics() {
  const [result, _] = await pool.execute<Record[]>("SELECT * FROM mastores");
  return result;
}

export async function getAllStates() {
  const [result, _] = await pool.execute<Record[]>("SELECT * FROM katastaseis");
  return result;
}

export async function getAllProducts() {
  const [result, _] = await pool.execute<Record[]>("SELECT * FROM eidi");
  return result;
}

export async function getAllManufacturers() {
  const [result, _] = await pool.execute<Record[]>("SELECT * FROM markes");
  return result;
}