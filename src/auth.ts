import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const allowedEmail = process.env.EMAIL_PERMITIDO;
      if (!user.email || !allowedEmail || user.email !== allowedEmail) {
        return false;
      }

      await db.insert(users).values({ email: user.email }).onConflictDoNothing({
        target: users.email,
      });

      return true;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
});

export async function currentUser() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    throw new Error("No hay sesión activa");
  }

  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!row) {
    throw new Error("Usuario no encontrado");
  }

  return row;
}
