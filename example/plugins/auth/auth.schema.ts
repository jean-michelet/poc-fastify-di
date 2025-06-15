import { Type, type Static } from '@sinclair/typebox'
import { EmailSchema, StringSchema } from '../common/schemas.ts';

export const CredentialsSchema = Type.Object({
  email: EmailSchema,
  password: StringSchema
})

export interface Credentials extends Static<typeof CredentialsSchema> {}

export interface Auth {
  id: number;
  username: string;
  email: string,
  roles: string[]
}
