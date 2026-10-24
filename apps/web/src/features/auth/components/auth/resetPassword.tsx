import { sendPasswordReset } from '@/lib/firebase/functions';
import TextInput from '../../../../components/ui/TextInput';
import AuthUiWrapper from '../ui/AuthUiWrapper';
import { useState, type SubmitEvent } from 'react';
import { cn } from 'cn';

const ResetPasswordForm = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    async function handleResetPassword(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setSubmitted(false);

        const normalizedEmail = email.trim();

        if (!normalizedEmail) {
            setError('Please enter your email address.');
            return;
        }

        setIsLoading(true);

        try {
            await sendPasswordReset(normalizedEmail);
            setSubmitted(true);
        } catch (error) {
            console.error('Error sending password reset email:', error);
            setError('Unable to send the reset email. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <AuthUiWrapper mode="reset-password">
            <form
                onSubmit={handleResetPassword}
                className="w-full flex items-center gap-3 flex-col"
            >
                <TextInput
                    type="email"
                    placeholder="e.g., name@example.com"
                    shape="rounded"
                    variant="bordered"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="px-5 py-3.5"
                    disabled={isLoading}
                    required
                />

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-sky/80 clickable hover:bg-sky smooth-300 p-3 rounded-full disabled:opacity-50"
                >
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>

                <p
                    role={error ? 'alert' : 'status'}
                    aria-live="polite"
                    className={cn(
                        'w-full text-center text-sm mt-3',
                        error ? 'text-red-500' : 'text-fr-primary/70'
                    )}
                >
                    {error ??
                        (submitted
                            ? 'If an account exists for this email, you will receive a password reset link.'
                            : '')}
                </p>
            </form>
        </AuthUiWrapper>
    );
};

export default ResetPasswordForm;
