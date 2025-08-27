import bcrypt from 'bcryptjs';

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

// In-memory user store (production would use database)
export class UserStore {
  private users: Map<string, User> = new Map();
  private usersByUsername: Map<string, User> = new Map();
  private usersByEmail: Map<string, User> = new Map();

  async createUser(input: CreateUserInput): Promise<User> {
    const { username, email, password } = input;

    // Check if user exists
    if (this.usersByUsername.has(username)) {
      throw new Error('Username already exists');
    }
    if (this.usersByEmail.has(email)) {
      throw new Error('Email already exists');
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user: User = {
      id: this.generateId(),
      username,
      email,
      passwordHash,
      createdAt: new Date(),
      isActive: true
    };

    // Store user
    this.users.set(user.id, user);
    this.usersByUsername.set(username, user);
    this.usersByEmail.set(email, user);

    return user;
  }

  async authenticateUser(input: LoginInput): Promise<User | null> {
    const user = this.usersByUsername.get(input.username);
    if (!user || !user.isActive) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
    return isValidPassword ? user : null;
  }

  async findUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findUserByUsername(username: string): Promise<User | null> {
    return this.usersByUsername.get(username) || null;
  }

  async deactivateUser(id: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;

    user.isActive = false;
    return true;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Development helper - create default admin user
  async createDefaultAdmin(): Promise<void> {
    try {
      await this.createUser({
        username: 'admin',
        email: 'admin@agentmux.local',
        password: 'admin123'
      });
      console.log('✅ Default admin user created: admin/admin123');
    } catch (error) {
      // User already exists, ignore
    }
  }
}