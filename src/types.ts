import { RowDataPacket } from "mysql2";
import { z } from "zod";

export interface NewRecord extends RowDataPacket {
  date: string;
  name: string;
  address: string;
  area: string;
  city: string;
  postalCode: string;
  phoneMobile: string;
  phoneHome?: string;
  email?: string;
  product: string;
  manufacturer: string;
  serial?: string;
  hasWarranty: boolean;
  warrantyDate?: string;
  status: number;
  mechanic: number;
  photo?: string;
  notesReceived?: string;
  notesRepaired?: string;
}

export interface Record extends NewRecord {
  id: number;
  history: History[];
}

export interface History extends RowDataPacket {
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
