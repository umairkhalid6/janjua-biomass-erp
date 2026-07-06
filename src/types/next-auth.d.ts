import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

// Augment session.user and the JWT with our id + role fields.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
