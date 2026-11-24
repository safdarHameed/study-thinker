/**
 * Enumerations shared by the web app and the API.
 * The ones stored as Prisma enums MUST match apps/api/prisma/schema.prisma.
 */
import { z } from 'zod';

const e = <const T extends readonly [string, ...string[]]>(values: T) => ({
  values,
  schema: z.enum(values),
});

export const UserRole = e(['LEARNER', 'ADMIN']);
export type UserRole = (typeof UserRole.values)[number];

export const UserStatus = e(['ACTIVE', 'SUSPENDED', 'DELETED']);
export type UserStatus = (typeof UserStatus.values)[number];

/** DRAFT: AI options ready to choose · BUILDING: journey being created · READY · FAILED */
export const LearningStatus = e(['DRAFT', 'BUILDING', 'READY', 'FAILED']);
export type LearningStatus = (typeof LearningStatus.values)[number];
