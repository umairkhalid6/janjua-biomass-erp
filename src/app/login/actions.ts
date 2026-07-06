"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

// Credentials sign-in. On success signIn throws a redirect (which we must
// rethrow); on bad credentials it throws AuthError → show a message.
export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const callbackUrl = String(formData.get("callbackUrl") || "/");
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: callbackUrl,
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error; // redirect() and other control-flow errors
  }
}
