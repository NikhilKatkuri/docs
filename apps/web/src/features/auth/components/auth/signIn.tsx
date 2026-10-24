import { useState, type SubmitEvent } from 'react';

import TextInput, { PasswordInput } from '../../../../components/ui/TextInput';
import { useAuth } from '../../provider/AuthProvider';
import AuthUiWrapper from '../ui/AuthUiWrapper';
import { NavLink } from 'react-router';
import { cn } from 'cn';
import { signInWithPassword, validatePasswordStrength } from '@/lib/firebase';

const SignInForm = () => {
    const { makeAuth, loading } = useAuth();
    const [formFields, setFormFields] = useState({
        email: '',
        password: '',
    });

    const [error, setError] = useState<{
        form?: string;
        email?: string;
        password?: string;
    } | null>(null);

    const patch = (field: keyof typeof formFields, value: string) => {
        setFormFields((prev) => ({ ...prev, [field]: value }));
    };

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        if (Object.values(formFields).some((v) => !v.trim())) {
            setError({ form: 'All fields are required.' });
            return;
        }

        const passwordChecks = validatePasswordStrength(formFields.password);

        if (!passwordChecks.isValid) {
            setError({ password: passwordChecks.messages.join(', ') });
            return;
        }

        try {
            await makeAuth(() =>
                signInWithPassword(formFields.email, formFields.password)
            );
        } catch (error) {
            setError({
                form:
                    error instanceof Error
                        ? error.message
                        : 'Unable to signin to your account. Please try again.',
            });
        }
    }
    return (
        <AuthUiWrapper>
            <form
                onSubmit={handleSubmit}
                className="w-full flex items-center gap-3 flex-col"
            >
                <TextInput
                    type="email"
                    placeholder="e.g., name@example.com"
                    shape="rounded"
                    value={formFields.email}
                    name="email"
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
                    placeholder="password"
                    shape="rounded"
                    variant="bordered"
                    value={formFields.password}
                    name="password"
                    error={error?.password}
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
                    disabled={Object.values(formFields).some((v) => v === '')}
                    className="w-full bg-sky/80 clickable hover:bg-sky smooth-300 p-3  rounded-full"
                >
                    {loading ? 'Signing you in...' : 'Continue'}
                </button>
                <p
                    role={error?.form ? 'alert' : undefined}
                    aria-live="polite"
                    className={cn(
                        'w-full rounded-full text-center text-sm',
                        error?.form ? 'text-red-500' : 'text-fr-primary/50'
                    )}
                >
                    {error?.form ??
                        'we will never share your email with anyone else.'}
                </p>
            </form>
            <div className="text-center flex flex-col items-center gap-3 my-5">
                <p className="text-sm flex gap-2">
                    Don't have an account?
                    <NavLink
                        to="/auth/sign-up"
                        className="text-blue-600 underline-offset-4 underline"
                    >
                        Create one
                    </NavLink>
                </p>
                <p className="text-sm flex gap-2">
                    Forgot your password?
                    <NavLink
                        to="/auth/reset-password"
                        className="text-blue-600 underline-offset-4 underline"
                    >
                        Reset it
                    </NavLink>
                </p>
            </div>
        </AuthUiWrapper>
    );
};

export default SignInForm;
