export interface ValidationError {
    field: string;
    message: string;
}
export declare class Validator {
    static validateTmuxTarget(target: string): ValidationError[];
    static validateSessionName(name: string): ValidationError[];
    static validateWindowName(name: string): ValidationError[];
    static validateMessage(message: string): ValidationError[];
    static validateWorkingDir(dir: string): ValidationError[];
}
//# sourceMappingURL=validation.d.ts.map