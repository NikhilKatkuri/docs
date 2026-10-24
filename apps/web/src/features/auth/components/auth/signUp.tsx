import { useEffect, useState, type SubmitEvent } from 'react';
import TextInput, { PasswordInput } from '../../../../components/ui/TextInput';
import AuthUiWrapper from '../ui/AuthUiWrapper';
import { NavLink } from 'react-router';
import { signUpWithPassword, validatePasswordStrength } from '@/lib/firebase';
import { cn } from 'cn';
import { useAuth } from '../../provider/AuthProvider';

const placeholders = [
    'Your privacy matters.',
    'Built with security in mind.',
    'Your data deserves protection.',
    'Security starts at signup.',
    'A safer space for your work.',
    'Your account, your control.',
    'Privacy by design.',
];

const SignUpForm = () => {
    const { makeAuth, loading } = useAuth();
    const [formFields, setFormFields] = useState({
        email: '',
        password: '',
        confirmPassword: '',
    });

    const [error, setError] = useState<{
        form?: string;
        email?: string;
        password?: string;
        confirmPassword?: string;
    } | null>(null);

    const [placeholderIndex, setPlaceholderIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    const patch = (field: keyof typeof formFields, value: string) => {
        setFormFields((prev) => ({ ...prev, [field]: value }));
    };

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const { email, password, confirmPassword } = formFields;

        if ([email, password, confirmPassword].some((v) => !v.trim())) {
            setError({ form: 'All fields are required.' });
            return;
        }

        if (password !== confirmPassword) {
            setError({ confirmPassword: 'Passwords do not match.' });
            return;
        }

        const passwordChecks = validatePasswordStrength(password);

        if (!passwordChecks.isValid) {
            setError({ password: passwordChecks.messages.join(', ') });
            return;
        }

        try {
            await makeAuth(() => signUpWithPassword(email, password));
        } catch (error) {
            setError({
                form:
                    error instanceof Error
                        ? error.message
                        : 'Unable to create your account. Please try again.',
            });
        }
    }

    return (
        <AuthUiWrapper mode="sign-up">
            <form
                className="w-full flex items-center gap-3 flex-col"
                onSubmit={handleSubmit}
            >
                <TextInput
                    type="email"
                    placeholder="e.g., name@example.com"
                    shape="rounded"
                    variant="bordered"
                    value={formFields.email}
                    name="email"
                    onChange={(e) =>
                        patch(
                            e.target.name as keyof typeof formFields,
                            e.target.value
                        )
                    }
                    className="px-5 py-3.5"
                />

                <PasswordInput
                    placeholder="Create password"
                    shape="rounded"
                    name="password"
                    value={formFields.password}
                    error={error?.password}
                    onChange={(e) =>
                        patch(
                            e.target.name as keyof typeof formFields,
                            e.target.value
                        )
                    }
                    variant="bordered"
                    className="px-5 py-3.5"
                />

                <PasswordInput
                    placeholder="Confirm password"
                    shape="rounded"
                    variant="bordered"
                    name="confirmPassword"
                    value={formFields.confirmPassword}
                    onChange={(e) =>
                        patch(
                            e.target.name as keyof typeof formFields,
                            e.target.value
                        )
                    }
                    className="px-5 py-3.5"
                />

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-sky/80 clickable hover:bg-sky smooth-300 p-3 rounded-full"
                >
                    <p className="">
                        {loading ? 'Creating account...' : 'Continue'}
                    </p>
                </button>
                <p
                    role={error?.form ? 'alert' : undefined}
                    aria-live="polite"
                    className={cn(
                        'w-full rounded-full text-center text-sm',
                        error?.form ? 'text-red-500' : 'text-fr-primary/50'
                    )}
                >
                    {error?.form ?? placeholders[placeholderIndex]}
                </p>
            </form>
            <div className="text-center my-5">
                <p className="text-sm flex gap-2">
                    Already have an account?
                    <NavLink
                        to="/auth/sign-in"
                        className="text-blue-600 underline-offset-4 underline"
                    >
                        Sign in
                    </NavLink>
                </p>
            </div>
        </AuthUiWrapper>
    );
};

export default SignUpForm;
