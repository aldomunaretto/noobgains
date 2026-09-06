export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/((?!api/auth|login|manifest.json|icons/|favicon.ico|_next/static|_next/image).*)"],
};
