import "dotenv/config";
import { createPool } from "mysql2/promise";
import { AuthResponse, History, Record } from "./types.ts";

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

export async function getAllRecords() {
  const [result, _] = await pool.execute<Record[]>(
    "SELECT * FROM episkeves_read"
  );
  return result;
}

export async function getAllRecordsByMechanic(id: number) {
  const [result, _] = await pool.execute<Record[]>(
    `SELECT er.* FROM episkeves_read er
    JOIN episkeves e ON er.id = e.id
    WHERE e.mastoras_p = ?`,
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

export async function getAllOptions() {
  return {
    //mechanics: await getAllMechanics(),
    states: await getAllStates(),
    products: await getAllProducts(),
    brands: await getAllBrands(),
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

export async function getAllBrands() {
  const [result, _] = await pool.execute<Record[]>("SELECT * FROM markes");
  return result;
}
