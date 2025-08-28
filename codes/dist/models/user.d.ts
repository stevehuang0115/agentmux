export interface User {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
    isActive: boolean;
}
export interface CreateUserInput {
    username: string;
    email: string;
    password: string;
}
export interface LoginInput {
    username: string;
    password: string;
}
export declare class UserStore {
    private users;
    private usersByUsername;
    private usersByEmail;
    createUser(input: CreateUserInput): Promise<User>;
    authenticateUser(input: LoginInput): Promise<User | null>;
    findUserById(id: string): Promise<User | null>;
    findUserByUsername(username: string): Promise<User | null>;
    deactivateUser(id: string): Promise<boolean>;
    private generateId;
    createDefaultAdmin(): Promise<void>;
}
//# sourceMappingURL=user.d.ts.map