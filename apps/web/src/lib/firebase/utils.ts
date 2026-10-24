export type PasswordRequirement =
    | 'minLength'
    | 'maxLength'
    | 'lowercase'
    | 'uppercase'
    | 'number'
    | 'special';

export type PasswordStrengthResult =
    | { isValid: true }
    | {
          isValid: false;
          failed: PasswordRequirement[];
          messages: string[];
      };

export function validatePasswordStrength(
    password: string
): PasswordStrengthResult {
    const opts = {
        minPasswordLength: 6,
        maxPasswordLength: 128,
        requireLowercase: true,
        requireUppercase: true,
        requireNumeric: true,
        requireNonAlphanumeric: true,
    } as const;

    const checks: Array<[PasswordRequirement, boolean, string]> = [
        [
            'minLength',
            password.length >= opts.minPasswordLength,
            `At least ${opts.minPasswordLength} characters`,
        ],
        [
            'maxLength',
            password.length <= opts.maxPasswordLength,
            `At most ${opts.maxPasswordLength} characters`,
        ],
        ['lowercase', /[a-z]/.test(password), 'One lowercase letter'],
        ['uppercase', /[A-Z]/.test(password), 'One uppercase letter'],
        ['number', /[0-9]/.test(password), 'One number'],
        ['special', /[^a-zA-Z0-9]/.test(password), 'One special character'],
    ];

    const unmet = checks.filter(([, met]) => !met);

    return unmet.length === 0
        ? { isValid: true }
        : {
              isValid: false,
              failed: unmet.map(([req]) => req),
              messages: unmet.map(([, , msg]) => msg),
          };
}
