import { RowDataPacket } from "mysql2";
import { z } from "zod";

export interface Record extends RowDataPacket {
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
