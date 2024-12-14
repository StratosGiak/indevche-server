import { RowDataPacket } from "mysql2";
import { z } from "zod";

export interface DatabaseRecord extends RowDataPacket {
  id: number;
  datek: string;
  onomatep: string;
  odos?: string;
  perioxi?: string;
  poli?: string;
  tk?: string;
  kinito: string;
  tilefono?: string;
  email?: string;
  eidos: string;
  marka?: string;
  serialnr?: string;
  warranty: boolean;
  datekwarr?: string;
  pliromi?: string;
  prokatavoli: string;
  katastasi_p: number;
  mastoras_p: number;
  photos: string[];
  paratiriseis_para: string;
  paratiriseis_epi?: string;
  katastima: number;
  istoriko: DatabaseHistory[];
}

export interface DatabaseHistory extends RowDataPacket {
  id: number;
  episkevi_id: number;
  mastoras_p: number;
  datek: string;
  paratiriseis: string;
}

export interface DatabaseUser extends RowDataPacket {
  id: number;
  onoma: string;
  password: string;
  username: string;
}

export interface DatabaseStore extends RowDataPacket {
  onoma: string;
  odos: string;
}

export interface NewRecord {
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
  photos: string[];
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

export interface NewHistory {
  recordId: number;
  mechanic: number;
  date: string;
  notes: string;
}

export interface History extends NewHistory {
  id: number;
}

export interface User {
  id: number;
  name: string;
  password: string;
  username: string;
}

export interface Store {
  area: string;
  address: string;
}

export interface Photo {
  id: string;
  recordId: number;
  order: number;
}

export enum SmsType {
  Repaired,
  Unrepairable,
  Thanks,
}

export interface FormTemplate {
  xfdf: {
    fields: {
      field: { value: string; "@_name": keyof FormData }[];
    };
  };
}

export interface FormData {
  id: string;
  date: string;
  name: string;
  address?: string;
  city?: string;
  phoneMobile: string;
  product: string;
  manufacturer?: string;
  advance: string;
  notesReceived: string;
}

export const AuthRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export type AuthRequest = z.infer<typeof AuthRequestSchema>;
