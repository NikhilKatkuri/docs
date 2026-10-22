import { validatePassword } from 'firebase/auth';
import { auth } from './functions';

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

export async function validatePasswordStrength(
    password: string
): Promise<PasswordStrengthResult> {
    const status = await validatePassword(auth, password);
    if (status.isValid) return { isValid: true };

    const opts = status.passwordPolicy.customStrengthOptions;

    const checks: Array<[PasswordRequirement, boolean | undefined, string]> = [
        [
            'minLength',
            status.meetsMinPasswordLength,
            `At least ${opts.minPasswordLength} characters`,
        ],
        [
            'maxLength',
            status.meetsMaxPasswordLength,
            `At most ${opts.maxPasswordLength} characters`,
        ],
        ['lowercase', status.containsLowercaseLetter, 'One lowercase letter'],
        ['uppercase', status.containsUppercaseLetter, 'One uppercase letter'],
        ['number', status.containsNumericCharacter, 'One number'],
        [
            'special',
            status.containsNonAlphanumericCharacter,
            'One special character',
        ],
    ];

    const unmet = checks.filter(([, met]) => met === false);

    return {
        isValid: false,
        failed: unmet.map(([req]) => req),
        messages: unmet.map(([, , msg]) => msg),
    };
}
