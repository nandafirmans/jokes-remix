import bcrypt from "bcryptjs";
import { createCookieSessionStorage, redirect } from "remix";
import { db } from "./db.server";

type LoginForm = {
    username: string;
    password: string;
};

export async function register({ username, password }: LoginForm) {
    const passwordHash = await bcrypt.hash(password, 10);

    return await db.user.create({
        data: {
            username,
            passwordHash,
        },
    });
}

export async function login({ username, password }: LoginForm) {
    const user = await db.user.findUnique({ where: { username } });
    if (!user) return null;

    const isCorrectPassword = bcrypt.compare(password, user.passwordHash);
    if (!isCorrectPassword) return null;

    return user;
}

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
    throw new Error("SESSION_SECRET must be set"!);
}

const storage = createCookieSessionStorage({
    cookie: {
        name: "__ss",
        secure: process.env.NODE_ENV === "production",
        secrets: [sessionSecret],
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        httpOnly: true,
    },
});

const USER_ID_SESSION_KEY = "userId";

export async function getUserSession(request: Request) {
    return storage.getSession(request.headers.get("Cookie"));
}

export async function getUserId(request: Request) {
    const session = await getUserSession(request);
    const userId = session.get(USER_ID_SESSION_KEY);
    if (!userId || typeof userId !== "string") return null;
    return userId;
}

export async function requireUserId(
    request: Request,
    redirectTo: string = new URL(request.url).pathname
) {
    const userId = await getUserId(request);

    if (!userId || typeof userId !== "string") {
        const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
        throw redirect(`/login?${searchParams}`);
    }

    return userId;
}

export async function getUser(request: Request) {
    const userId = await getUserId(request);
    if (typeof userId !== "string") return null;

    try {
        const user = await db.user.findUnique({ where: { id: userId } });
        return user;
    } catch {
        throw logout(request);
    }
}

export async function logout(request: Request) {
    const session = await getUserSession(request);

    return redirect("/login", {
        headers: {
            "Set-Cookie": await storage.destroySession(session),
        },
    });
}

export async function createUserSession(userId: string, redirectTo: string) {
    const session = await storage.getSession();
    session.set(USER_ID_SESSION_KEY, userId);

    return redirect(redirectTo, {
        headers: {
            "Set-Cookie": await storage.commitSession(session),
        },
    });
}
