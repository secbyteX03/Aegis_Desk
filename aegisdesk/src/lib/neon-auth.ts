import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import * as jose from "jose";

// Use NEON_DATABASE_URL if available, fallback to DATABASE_URL
const DATABASE_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
    throw new Error("DATABASE_URL or NEON_DATABASE_URL not configured");
}

const sql = neon(DATABASE_URL);

// JWT Secret - in production, use a proper secret
const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || "aegisdesk-secret-key-change-in-production"
);

// Helper functions
function generateUUID(): string {
    return randomBytes(16).toString("hex");
}

function generateToken(): string {
    return randomBytes(32).toString("hex");
}

async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// Types
export interface User {
    id: string;
    email: string;
    password_hash?: string;
    full_name?: string;
    avatar_url?: string;
    email_verified: boolean;
    last_sign_in_at?: string;
    created_at: string;
    updated_at: string;
}

export interface Profile {
    id: string;
    role: string;
    organization_id?: string;
    bio?: string;
    timezone?: string;
    language?: string;
    preferences?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface Organization {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    created_at: string;
    updated_at: string;
}

export interface TeamMember {
    id: string;
    user_id: string;
    organization_id: string;
    email: string;
    full_name?: string;
    role: string;
    status: string;
    invited_by?: string;
    invited_at?: string;
    joined_at?: string;
    created_at: string;
    updated_at: string;
}

export interface AuthResult {
    success: boolean;
    user?: User;
    profile?: Profile;
    organization?: Organization;
    token?: string;
    error?: string;
}

// Create JWT token
async function createToken(userId: string, email: string): Promise<string> {
    const token = await new jose.SignJWT({
        sub: userId,
        email,
        type: "session"
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(JWT_SECRET);

    return token;
}

// Verify JWT token
export async function verifyToken(token: string): Promise<{ valid: boolean; userId?: string; email?: string }> {
    try {
        const { payload } = await jose.jwtVerify(token, JWT_SECRET);
        return { valid: true, userId: payload.sub as string, email: payload.email as string };
    } catch {
        return { valid: false };
    }
}

// Authentication functions
export class NeonAuth {
    // Register a new user
    static async register(data: {
        email: string;
        password: string;
        fullName?: string;
        organizationName?: string;
        role?: string;
    }): Promise<AuthResult> {
        try {
            const { email, password, fullName, organizationName, role } = data;

            // Check if user already exists
            const existingUsers = await sql`
        SELECT id FROM users WHERE email = ${email.toLowerCase()}
      `;

            if (existingUsers.length > 0) {
                return { success: false, error: "User with this email already exists" };
            }

            // Hash password
            const passwordHash = await hashPassword(password);

            // Create user
            const userId = generateUUID();
            const now = new Date().toISOString();

            await sql`
        INSERT INTO users (id, email, password_hash, full_name, email_verified, created_at, updated_at)
        VALUES (${userId}, ${email.toLowerCase()}, ${passwordHash}, ${fullName || null}, ${true}, ${now}, ${now})
      `;

            // Create organization if provided
            let organization: Organization | undefined;
            let orgId: string | undefined;

            if (organizationName) {
                orgId = generateUUID();
                const orgSlug = organizationName
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "");

                const slugWithTimestamp = `${orgSlug}-${Date.now()}`;

                await sql`
          INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
          VALUES (${orgId}, ${organizationName}, ${slugWithTimestamp}, ${userId}, ${now}, ${now})
        `;

                const orgs = await sql`SELECT * FROM organizations WHERE id = ${orgId}`;
                organization = orgs[0] as Organization;
            }

            // Create profile
            await sql`
        INSERT INTO profiles (id, role, organization_id, created_at, updated_at)
        VALUES (${userId}, ${role || "User"}, ${orgId || null}, ${now}, ${now})
      `;

            // Add user as team member if organization exists
            if (orgId) {
                const memberId = generateUUID();
                await sql`
          INSERT INTO team_members (id, user_id, organization_id, email, full_name, role, status, joined_at, created_at, updated_at)
          VALUES (${memberId}, ${userId}, ${orgId}, ${email.toLowerCase()}, ${fullName || null}, ${role || "Owner"}, ${"active"}, ${now}, ${now}, ${now})
        `;
            }

            // Get user and profile data
            const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
            const profiles = await sql`SELECT * FROM profiles WHERE id = ${userId}`;

            // Generate JWT token
            const token = await createToken(userId, email.toLowerCase());

            return {
                success: true,
                user: users[0] as User,
                profile: profiles[0] as Profile,
                organization,
                token,
            };
        } catch (error) {
            console.error("[NeonAuth] Register error:", error);
            return { success: false, error: "Registration failed" };
        }
    }

    // Login user
    static async login(email: string, password: string): Promise<AuthResult> {
        try {
            // Get user
            const users = await sql`
        SELECT * FROM users WHERE email = ${email.toLowerCase()}
      `;

            if (users.length === 0) {
                return { success: false, error: "Invalid email or password" };
            }

            const user = users[0] as User;

            // Verify password
            const passwordHash = user.password_hash || "";
            const passwordMatch = await verifyPassword(password, passwordHash);
            if (!passwordMatch) {
                return { success: false, error: "Invalid email or password" };
            }

            // Get profile
            const profiles = await sql`SELECT * FROM profiles WHERE id = ${user.id}`;
            const profile = profiles[0] as Profile;

            // Get organization if exists
            let organization: Organization | undefined;
            if (profile.organization_id) {
                const orgs = await sql`SELECT * FROM organizations WHERE id = ${profile.organization_id}`;
                organization = orgs[0] as Organization;
            }

            // Update last sign in
            const now = new Date().toISOString();
            await sql`UPDATE users SET last_sign_in_at = ${now}, updated_at = ${now} WHERE id = ${user.id}`;

            // Generate JWT token
            const token = await createToken(user.id, user.email);

            return {
                success: true,
                user,
                profile,
                organization,
                token,
            };
        } catch (error) {
            console.error("[NeonAuth] Login error:", error);
            return { success: false, error: "Login failed" };
        }
    }

    // Verify token and get current user
    static async verify(token: string): Promise<AuthResult> {
        try {
            const { valid, userId, email } = await verifyToken(token);

            if (!valid || !userId) {
                return { success: false, error: "Invalid or expired token" };
            }

            // Get user
            const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
            if (users.length === 0) {
                return { success: false, error: "User not found" };
            }

            const user = users[0] as User;

            // Get profile
            const profiles = await sql`SELECT * FROM profiles WHERE id = ${userId}`;
            const profile = profiles[0] as Profile;

            // Get organization
            let organization: Organization | undefined;
            if (profile.organization_id) {
                const orgs = await sql`SELECT * FROM organizations WHERE id = ${profile.organization_id}`;
                organization = orgs[0] as Organization;
            }

            return {
                success: true,
                user,
                profile,
                organization,
                token,
            };
        } catch (error) {
            console.error("[NeonAuth] Verify error:", error);
            return { success: false, error: "Verification failed" };
        }
    }

    // OAuth sign in - returns URL for redirect (for future use with Neon Auth)
    static async oauthSignIn(provider: "google" | "github"): Promise<{ success: boolean; url?: string; error?: string }> {
        // This would redirect to Neon Auth OAuth in production
        const authUrl = process.env.VITE_NEON_AUTH_URL;
        if (!authUrl) {
            return { success: false, error: "Neon Auth not configured" };
        }

        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/callback`;
        const url = `${authUrl}?provider=${provider}&redirect_uri=${encodeURIComponent(redirectUri)}`;

        return { success: true, url };
    }

    // Create OAuth user (for demo/testing)
    static async createOAuthUser(data: {
        provider: string;
        providerAccountId: string;
        email: string;
        fullName?: string;
        avatarUrl?: string;
        providerUserData?: any;
    }): Promise<AuthResult> {
        try {
            const { provider, email, fullName, avatarUrl } = data;

            // Check if user exists
            let users = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;

            let user: User;
            let isNewUser = false;

            if (users.length === 0) {
                // Create new user
                const userId = generateUUID();
                const now = new Date().toISOString();

                await sql`
          INSERT INTO users (id, email, full_name, avatar_url, email_verified, created_at, updated_at)
          VALUES (${userId}, ${email.toLowerCase()}, ${fullName || null}, ${avatarUrl || null}, ${true}, ${now}, ${now})
        `;

                // Create profile
                await sql`
          INSERT INTO profiles (id, role, created_at, updated_at)
          VALUES (${userId}, 'User', ${now}, ${now})
        `;

                users = await sql`SELECT * FROM users WHERE id = ${userId}`;
                isNewUser = true;
            }

            user = users[0] as User;

            // Get profile
            const profiles = await sql`SELECT * FROM profiles WHERE id = ${user.id}`;
            const profile = profiles[0] as Profile;

            // Get organization
            let organization: Organization | undefined;
            if (profile.organization_id) {
                const orgs = await sql`SELECT * FROM organizations WHERE id = ${profile.organization_id}`;
                organization = orgs[0] as Organization;
            }

            // Generate JWT token
            const token = await createToken(user.id, user.email);

            return {
                success: true,
                user,
                profile,
                organization,
                token,
            };
        } catch (error) {
            console.error("[NeonAuth] Create OAuth user error:", error);
            return { success: false, error: "OAuth user creation failed" };
        }
    }
}

export default NeonAuth;
