import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';
import { UserStore, User } from '../models/user';
export interface AuthenticatedRequest extends Request {
    user?: User;
    userId?: string;
}
export interface AuthenticatedSocket extends Socket {
    user?: User;
    userId?: string;
}
export declare class AuthService {
    private userStore;
    constructor(userStore: UserStore);
    generateToken(user: User): string;
    verifyToken(token: string): any;
    authenticate(): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    authenticateSocket(): (socket: AuthenticatedSocket, next: (err?: any) => void) => Promise<void>;
    createUserRateLimit(): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
}
export declare const validateAuthInput: {
    register: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
    login: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
};
//# sourceMappingURL=auth.d.ts.map