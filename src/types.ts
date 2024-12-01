import { RowDataPacket } from "mysql2";
import { z } from "zod";

export interface NewRecord extends RowDataPacket {
  date: string;
  name: string;
  address?: string;
  area?: string;
  city?: string;
  postalCode?: string;
  phoneMobile: string;
  phoneHome?: string;
  email?: string;
  product: string;
  manufacturer?: string;
  serial?: string;
  hasWarranty: boolean;
  warrantyDate?: string;
  status: number;
  mechanic: number;
  photo?: string;
  advance: string;
  fee?: string;
  notesReceived: string;
  notesRepaired?: string;
  store: number;
}

export interface Record extends NewRecord {
  id: number;
  history: History[];
  newHistory: NewHistory[];
}

export interface NewHistory extends RowDataPacket {
  recordId: number;
  mechanic: number;
  date: string;
  notes: string;
}

export interface History extends NewHistory {
  id: number;
}

export interface AuthResponse extends RowDataPacket {
  id: number;
  name: string;
  password: string;
}

export const AuthRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export type AuthRequest = z.infer<typeof AuthRequestSchema>;
